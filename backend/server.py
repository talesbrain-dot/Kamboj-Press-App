from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timedelta, timezone
import jwt
from passlib.context import CryptContext

from pymongo import ReturnDocument
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ.get('MONGO_URL', 'mongodb+srv://KambojPress:Saaa60086009@kambojpressapp.ltwgpub.mongodb.net/?appName=KambojPressApp')
client = AsyncIOMotorClient(mongo_url)
db = client['KambojPressApp']

SECRET_KEY = os.environ.get('JWT_SECRET', 'press-order-book-secret-key-change-in-prod')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

app = FastAPI()
api = APIRouter(prefix="/api")

PRODUCT_STATUSES = ["Pending", "Designing", "Offset", "Digital Printing", "Screen Printing", "Binding", "Flex", "Ready", "Delivered"]

# ---------- Models ----------
class UserCreate(BaseModel):
    name: str
    username: str
    password: str
    role: Literal["admin", "staff"] = "staff"

class UserOut(BaseModel):
    id: str
    name: str
    username: str
    role: str
    created_at: datetime

class LoginIn(BaseModel):
    username: str
    password: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

class ProductIn(BaseModel):
    name: str
    quantity: int = 1
    price: float = 0.0
    notes: Optional[str] = ""
    status: str = "Pending"

class ProductOut(ProductIn):
    id: str
    updated_at: Optional[datetime] = None

class OrderCreate(BaseModel):
    customer_name: str
    customer_phone: str
    customer_address: Optional[str] = ""
    products: List[ProductIn]
    assigned_user_ids: List[str] = []
    advance_paid: float = 0.0
    notes: Optional[str] = ""

class PaymentIn(BaseModel):
    amount: float
    note: Optional[str] = ""

class StatusUpdateIn(BaseModel):
    status: str

class OrderUpdateIn(BaseModel):
    assigned_user_ids: Optional[List[str]] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_address: Optional[str] = None
    notes: Optional[str] = None
    advance_paid: Optional[float] = None
    products: Optional[List[ProductIn]] = None

class SettingsIn(BaseModel):
    app_name: Optional[str] = None
    company_name: Optional[str] = None
    company_phone: Optional[str] = None
    company_address: Optional[str] = None
    logo_base64: Optional[str] = None
    reminder_in_process_days: Optional[int] = None
    reminder_delivery_days: Optional[int] = None
    reminder_payment_days: Optional[int] = None
    custom_reminders: Optional[List[dict]] = None

class DismissIn(BaseModel):
    key: str

# ---------- Helpers ----------
def hash_pw(p): return pwd_ctx.hash(p)
def verify_pw(p, h): return pwd_ctx.verify(p, h)

def make_token(user_id: str):
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        uid = payload.get("sub")
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": uid})
    if not user:
        raise HTTPException(401, "User not found")
    return user

async def require_admin(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    return user

def user_public(u):
    return normalize_dates({"id": u["id"], "name": u["name"], "username": u["username"], "role": u["role"], "created_at": u["created_at"]})

def clean_doc(d):
    if not d: return d
    d.pop("_id", None)
    return d

def _iso_utc(v):
    if isinstance(v, datetime):
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        return v.isoformat()
    return v

def normalize_dates(obj):
    if isinstance(obj, dict):
        return {k: normalize_dates(_iso_utc(v) if isinstance(v, datetime) else v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [normalize_dates(x) for x in obj]
    if isinstance(obj, datetime):
        return _iso_utc(obj)
    return obj

# ---------- Auth ----------
@app.post("/auth/login")
@api.post("/auth/login", response_model=TokenOut)
async def login(data: LoginIn):
    user = await db.users.find_one({"username": data.username.lower().strip()})
    if not user or not verify_pw(data.password, user["password_hash"]):
        raise HTTPException(401, "Invalid username or password")
    return {"access_token": make_token(user["id"]), "token_type": "bearer", "user": user_public(user)}

@api.get("/auth/me", response_model=UserOut)
async def me(user=Depends(get_current_user)):
    return user_public(user)

@api.post("/users", response_model=UserOut)
async def create_user(data: UserCreate, admin=Depends(require_admin)):
    uname = data.username.lower().strip()
    if await db.users.find_one({"username": uname}):
        raise HTTPException(400, "Username already exists")
    user = {
        "id": str(uuid.uuid4()),
        "name": data.name.strip(),
        "username": uname,
        "password_hash": hash_pw(data.password),
        "role": data.role,
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(user)
    return user_public(user)

@api.get("/users", response_model=List[UserOut])
async def list_users(user=Depends(get_current_user)):
    users = await db.users.find().sort("created_at", -1).to_list(500)
    return [user_public(u) for u in users]

@api.delete("/users/{user_id}")
async def delete_user(user_id: str, admin=Depends(require_admin)):
    if user_id == admin["id"]:
        raise HTTPException(400, "Cannot delete yourself")
    res = await db.users.delete_one({"id": user_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "User not found")
    return {"ok": True}

# ---------- Customers ----------
async def upsert_customer(name: str, phone: str, address: str = ""):
    phone = phone.strip()
    name = name.strip()
    existing = await db.customers.find_one({"phone": phone})
    if existing:
        update = {"name": name or existing.get("name"), "updated_at": datetime.now(timezone.utc)}
        if address: update["address"] = address
        await db.customers.update_one({"id": existing["id"]}, {"$set": update})
        return existing["id"]
    cid = str(uuid.uuid4())
    await db.customers.insert_one({
        "id": cid, "name": name, "phone": phone, "address": address,
        "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc),
    })
    return cid

@api.get("/customers")
async def list_customers(q: Optional[str] = None, user=Depends(get_current_user)):
    query = {}
    if q:
        query = {"$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
        ]}
    customers = await db.customers.find(query).sort("updated_at", -1).to_list(500)

    # Aggregate balance + order count per customer in a single pass.
    customer_ids = [c.get("id") for c in customers if c.get("id")]
    balance_map = {cid: {"total_balance": 0.0, "total_orders": 0, "total_business": 0.0} for cid in customer_ids}
    if customer_ids:
        async for o in db.orders.find({"customer_id": {"$in": customer_ids}}):
            cid = o.get("customer_id")
            if cid not in balance_map:
                continue
            total = sum((p.get("price", 0) or 0) for p in o.get("products", []))
            paid = (o.get("advance_paid", 0) or 0) + sum(p.get("amount", 0) for p in o.get("payments", []))
            balance = max(total - paid, 0)
            balance_map[cid]["total_balance"] += balance
            balance_map[cid]["total_business"] += total
            balance_map[cid]["total_orders"] += 1

    out = []
    for c in customers:
        d = normalize_dates(clean_doc(c))
        info = balance_map.get(d.get("id"), {"total_balance": 0.0, "total_orders": 0, "total_business": 0.0})
        d["total_balance"] = round(info["total_balance"], 2)
        d["total_business"] = round(info["total_business"], 2)
        d["total_orders"] = info["total_orders"]
        out.append(d)
    return out

@api.get("/customers/{customer_id}")
async def get_customer(customer_id: str, user=Depends(get_current_user)):
    c = await db.customers.find_one({"id": customer_id})
    if not c: raise HTTPException(404, "Customer not found")
    orders = await db.orders.find({"customer_id": customer_id}).sort("created_at", -1).to_list(500)
    return {"customer": normalize_dates(clean_doc(c)), "orders": [serialize_order(o) for o in orders]}

@api.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, admin=Depends(require_admin)):
    c = await db.customers.find_one({"id": customer_id})
    if not c: raise HTTPException(404, "Customer not found")
    order_count = await db.orders.count_documents({"customer_id": customer_id})
    if order_count > 0:
        raise HTTPException(400, f"Cannot delete customer with {order_count} order(s). Delete the orders first.")
    await db.customers.delete_one({"id": customer_id})
    return {"ok": True}

# ---------- Orders ----------
async def next_order_no():
    res = await db.counters.find_one_and_update(
        {"_id": "order_no"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    seq = res.get("seq", 1) if res else 1
    return f"ORD-{seq:04d}"

def order_total(order):
    return sum((p.get("price", 0) or 0) for p in order.get("products", []))

def order_paid(order):
    return (order.get("advance_paid", 0) or 0) + sum(p.get("amount", 0) for p in order.get("payments", []))

def serialize_order(o):
    o = clean_doc(o)
    total = order_total(o)
    paid = order_paid(o)
    o["total"] = total
    o["paid"] = paid
    o["balance"] = max(total - paid, 0)
    return normalize_dates(o)

@api.post("/orders")
async def create_order(data: OrderCreate, user=Depends(get_current_user)):
    if not data.customer_name.strip() or not data.customer_phone.strip():
        raise HTTPException(400, "Customer name and phone are required")
    if not data.products:
        raise HTTPException(400, "At least one product is required")
    customer_id = await upsert_customer(data.customer_name, data.customer_phone, data.customer_address or "")
    order_no = await next_order_no()
    now = datetime.now(timezone.utc)
    products = []
    for p in data.products:
        st = p.status if p.status in PRODUCT_STATUSES else "Pending"
        products.append({
            "id": str(uuid.uuid4()),
            "name": p.name.strip(),
            "quantity": p.quantity,
            "price": p.price,
            "notes": p.notes or "",
            "status": st,
            "updated_at": now,
        })
    assigned = list(data.assigned_user_ids or [])
    if user.get("role") == "staff" and user["id"] not in assigned:
        assigned.append(user["id"])
    order = {
        "id": str(uuid.uuid4()),
        "order_no": order_no,
        "customer_id": customer_id,
        "customer_name": data.customer_name.strip(),
        "customer_phone": data.customer_phone.strip(),
        "customer_address": data.customer_address or "",
        "products": products,
        "assigned_user_ids": assigned,
        "advance_paid": data.advance_paid or 0.0,
        "payments": [],
        "notes": data.notes or "",
        "created_by": user["id"],
        "created_by_name": user["name"],
        "created_at": now,
        "updated_at": now,
    }
    await db.orders.insert_one(order)
    return serialize_order(order)

@api.get("/orders")
async def list_orders(user=Depends(get_current_user)):
    orders = await db.orders.find().sort("created_at", -1).to_list(1000)
    return [serialize_order(o) for o in orders]

@api.get("/orders/balance/list")
async def list_balance_orders(user=Depends(get_current_user)):
    """Return only orders that still have an outstanding balance > 0,
    sorted by most outstanding first."""
    orders = await db.orders.find().sort("created_at", -1).to_list(2000)
    serialized = [serialize_order(o) for o in orders]
    pending = [o for o in serialized if (o.get("balance") or 0) > 0]
    pending.sort(key=lambda x: x.get("balance", 0), reverse=True)
    return pending

@api.get("/orders/{order_id}")
async def get_order(order_id: str, user=Depends(get_current_user)):
    o = await db.orders.find_one({"id": order_id})
    if not o: raise HTTPException(404, "Order not found")
    return serialize_order(o)

@api.patch("/orders/{order_id}")
async def update_order(order_id: str, data: OrderUpdateIn, user=Depends(get_current_user)):
    o = await db.orders.find_one({"id": order_id})
    if not o: raise HTTPException(404, "Order not found")
    if user["role"] == "staff":
        raise HTTPException(403, "Only admins can modify order")
    now = datetime.now(timezone.utc)
    update = {"updated_at": now}
    if data.assigned_user_ids is not None: update["assigned_user_ids"] = data.assigned_user_ids
    if data.customer_address is not None: update["customer_address"] = data.customer_address
    if data.notes is not None: update["notes"] = data.notes
    if data.advance_paid is not None: update["advance_paid"] = float(data.advance_paid)

    new_name = data.customer_name.strip() if data.customer_name else None
    new_phone = data.customer_phone.strip() if data.customer_phone else None
    if new_name or new_phone:
        final_name = new_name or o.get("customer_name")
        final_phone = new_phone or o.get("customer_phone")
        if not final_name or not final_phone:
            raise HTTPException(400, "Customer name and phone are required")
        addr = data.customer_address if data.customer_address is not None else o.get("customer_address", "")
        new_customer_id = await upsert_customer(final_name, final_phone, addr)
        update["customer_id"] = new_customer_id
        update["customer_name"] = final_name
        update["customer_phone"] = final_phone

    if data.products is not None:
        if not data.products:
            raise HTTPException(400, "At least one product is required")
        new_products = []
        for p in data.products:
            st = p.status if p.status in PRODUCT_STATUSES else "Pending"
            prod = {
                "id": str(uuid.uuid4()),
                "name": p.name.strip(),
                "quantity": p.quantity,
                "price": p.price,
                "notes": p.notes or "",
                "status": st,
                "updated_at": now,
            }
            new_products.append(prod)
        update["products"] = new_products

    await db.orders.update_one({"id": order_id}, {"$set": update})
    o = await db.orders.find_one({"id": order_id})
    return serialize_order(o)

@api.patch("/orders/{order_id}/products/{product_id}")
async def update_product_status(order_id: str, product_id: str, data: StatusUpdateIn, user=Depends(get_current_user)):
    if data.status not in PRODUCT_STATUSES:
        raise HTTPException(400, "Invalid status")
    o = await db.orders.find_one({"id": order_id})
    if not o: raise HTTPException(404, "Order not found")
    if user["role"] == "staff" and user["id"] not in o.get("assigned_user_ids", []):
        raise HTTPException(403, "Not assigned to this order")
    now = datetime.now(timezone.utc)
    res = await db.orders.update_one(
        {"id": order_id, "products.id": product_id},
        {"$set": {"products.$.status": data.status, "products.$.updated_at": now, "updated_at": now}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Product not found in order")
    o = await db.orders.find_one({"id": order_id})
    return serialize_order(o)

@api.post("/orders/{order_id}/payments")
async def add_payment(order_id: str, data: PaymentIn, user=Depends(get_current_user)):
    if user["role"] == "staff":
        raise HTTPException(403, "Only admins can record payments")
    o = await db.orders.find_one({"id": order_id})
    if not o: raise HTTPException(404, "Order not found")
    payment = {"id": str(uuid.uuid4()), "amount": data.amount, "note": data.note or "", "at": datetime.now(timezone.utc), "by": user["name"]}
    await db.orders.update_one({"id": order_id}, {"$push": {"payments": payment}, "$set": {"updated_at": datetime.now(timezone.utc)}})
    o = await db.orders.find_one({"id": order_id})
    return serialize_order(o)

@api.delete("/orders/{order_id}")
async def delete_order(order_id: str, admin=Depends(require_admin)):
    res = await db.orders.delete_one({"id": order_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Order not found")
    return {"ok": True}

# ---------- Reminders ----------
@api.get("/reminders")
async def reminders(request: Request, include_seen: bool = True, user=Depends(get_current_user)):
    # Header se pata chalega ki request kis page se aa rahi hai
    referer = request.headers.get("referer", "")
    
    # 🔥 Agar url mein 'dashboard' word hai, toh reminders mat dikhao!
    if "dashboard" in referer.lower():
        return []

    if user["role"] == "staff":
        return []
        
    s = await db.settings.find_one({"id": "default"}) or {}
    in_proc_days = s.get("reminder_in_process_days", 2)
    delivery_days = s.get("reminder_delivery_days", 7)
    payment_days = s.get("reminder_payment_days", 10)
    customs = s.get("custom_reminders", [])
    dismissed = set(s.get("dismissed_reminders", []))

    now = datetime.now(timezone.utc)
    orders = await db.orders.find().sort("created_at", -1).to_list(1000)
    out = []
    
    for o in orders:
        try:
            statuses = [p.get("status") for p in o.get("products", [])]
            all_pending = all(st == "Pending" for st in statuses) if statuses else False
            all_delivered = all(st == "Delivered" for st in statuses) if statuses else False
            
            created_at = o.get("created_at")
            if not created_at: continue
            
            if isinstance(created_at, str):
                try:
                    if "Z" in created_at:
                        created_at = created_at.replace("Z", "+00:00")
                    created_at_dt = datetime.fromisoformat(created_at)
                except Exception:
                    continue
            else:
                created_at_dt = created_at
                if created_at_dt.tzinfo is None:
                    created_at_dt = created_at_dt.replace(tzinfo=timezone.utc)
            
            age_days = (now - created_at_dt).days
            
            total = sum((float(p.get("price") or 0)) for p in o.get("products", []))
            advance = float(o.get("advance_paid") or 0)
            p_payments = sum(float(p.get("amount") or 0) for p in o.get("payments", []))
            paid = advance + p_payments
            balance = max(total - paid, 0)

            def make(rtype, message, key_suffix=""):
                key = f"{o['id']}:{rtype}{(':' + key_suffix) if key_suffix else ''}"
                return {
                    "key": key,
                    "type": rtype,
                    "order_id": o["id"],
                    "order_no": o.get("order_no"),
                    "customer_name": o.get("customer_name"),
                    "customer_phone": o.get("customer_phone"),
                    "message": message,
                    "age_days": age_days,
                    "seen": key in dismissed,
                }

            if all_pending and age_days >= in_proc_days:
                out.append(make("in_process", f"Order not moved to In Process for {age_days} day(s)"))
            if not all_delivered and statuses and age_days >= delivery_days:
                out.append(make("delivery", f"Order not delivered after {age_days} day(s)"))
            if balance > 0 and age_days >= payment_days:
                out.append(make("payment", f"Payment pending: balance ₹{balance:.0f} after {age_days} day(s)"))
            
            for cr in customs:
                try:
                    d = int(cr.get("days", 0))
                    label = cr.get("label", "Custom reminder")
                    if d > 0 and age_days >= d and not all_delivered:
                        out.append(make("custom", f"{label} ({age_days} day(s) since creation)", key_suffix=label))
                except Exception:
                    pass
        except Exception as e:
            continue

    if not include_seen:
        out = [r for r in out if not r["seen"]]
        
    out.sort(key=lambda r: r.get("age_days", 0), reverse=True)
    return out
    
# ---------- Settings ----------
DEFAULT_SETTINGS = {
    "id": "default",
    "app_name": "Press Order Book",
    "company_name": "Press Order Book",
    "company_phone": "",
    "company_address": "",
    "logo_base64": "",
    "reminder_in_process_days": 2,
    "reminder_delivery_days": 7,
    "reminder_payment_days": 10,
    "custom_reminders": [],
    "dismissed_reminders": [],
}

@api.get("/settings")
async def get_settings(user=Depends(get_current_user)):
    s = await db.settings.find_one({"id": "default"})
    if not s:
        s = DEFAULT_SETTINGS.copy()
        await db.settings.insert_one(s)
    return clean_doc(s)

@api.patch("/settings")
async def update_settings(data: SettingsIn, admin=Depends(require_admin)):
    s = await db.settings.find_one({"id": "default"})
    if not s:
        s = DEFAULT_SETTINGS.copy()
        await db.settings.insert_one(s)
    update = {k: v for k, v in data.dict().items() if v is not None}
    if update:
        await db.settings.update_one({"id": "default"}, {"$set": update})
    s = await db.settings.find_one({"id": "default"})
    return clean_doc(s)

# ---------- Branding (public — used by login screen and header) ----------
@app.get("/branding")
@api.get("/branding")
async def get_branding():
    s = await db.settings.find_one({"id": "default"})
    if not s:
        s = DEFAULT_SETTINGS.copy()
    return {
        "app_name": s.get("app_name") or "Press Order Book",
        "company_name": s.get("company_name") or "",
        "logo_base64": s.get("logo_base64") or "",
    }

# ---------- Backup (Excel) ----------
def _fmt_dt(val):
    if not val:
        return ""
    if isinstance(val, datetime):
        return val.strftime("%Y-%m-%d %H:%M:%S")
    return str(val)


def _style_header(ws, num_cols):
    header_font = Font(bold=True, color="FFFFFF")
    fill = PatternFill("solid", fgColor="F97316")  # orange-500
    align = Alignment(horizontal="left", vertical="center")
    for col_idx in range(1, num_cols + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.font = header_font
        cell.fill = fill
        cell.alignment = align
    ws.freeze_panes = "A2"


def _autosize(ws):
    for col in ws.columns:
        try:
            letter = col[0].column_letter
        except AttributeError:
            continue
        max_len = 0
        for cell in col:
            v = cell.value
            if v is None:
                continue
            length = len(str(v))
            if length > max_len:
                max_len = length
        ws.column_dimensions[letter].width = min(max(max_len + 2, 12), 50)


async def _build_backup_workbook() -> bytes:
    users = await db.users.find().to_list(10000)
    customers = await db.customers.find().to_list(10000)
    orders = await db.orders.find().sort("created_at", -1).to_list(100000)
    settings_doc = await db.settings.find_one({"id": "default"}) or {}

    customer_map = {c.get("id"): c for c in customers}

    wb = Workbook()

    # Sheet 1 - Summary
    ws = wb.active
    ws.title = "Summary"
    ws.append(["Field", "Value"])
    ws.append(["App Name", settings_doc.get("app_name") or "Press Order Book"])
    ws.append(["Company Name", settings_doc.get("company_name") or ""])
    ws.append(["Company Phone", settings_doc.get("company_phone") or ""])
    ws.append(["Company Address", settings_doc.get("company_address") or ""])
    ws.append(["Exported At", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")])
    ws.append(["Total Users", len(users)])
    ws.append(["Total Customers", len(customers)])
    ws.append(["Total Orders", len(orders)])
    total_revenue = 0.0
    total_paid_all = 0.0
    total_balance_all = 0.0
    for o in orders:
        t = sum((p.get("price", 0) or 0) for p in o.get("products", []))
        pd = (o.get("advance_paid", 0) or 0) + sum(p.get("amount", 0) for p in o.get("payments", []))
        total_revenue += t
        total_paid_all += pd
        total_balance_all += max(t - pd, 0)
    ws.append(["Total Order Value (INR)", round(total_revenue, 2)])
    ws.append(["Total Paid (INR)", round(total_paid_all, 2)])
    ws.append(["Total Outstanding Balance (INR)", round(total_balance_all, 2)])
    _style_header(ws, 2)
    _autosize(ws)

    # Sheet 2 - Orders (one row per order)
    ws = wb.create_sheet("Orders")
    headers = [
        "Order No", "Date Created", "Last Updated", "Customer Name", "Customer Phone", "Customer Address",
        "Products Count", "Products (name x qty @ price [status])",
        "Total (INR)", "Advance Paid (INR)", "Other Payments (INR)", "Paid (INR)", "Balance (INR)",
        "Created By", "Assigned User IDs", "Order Notes",
    ]
    ws.append(headers)
    for o in orders:
        prods = o.get("products", [])
        total = sum((p.get("price", 0) or 0) for p in prods)
        advance = o.get("advance_paid", 0) or 0
        other_pmts = sum(p.get("amount", 0) for p in o.get("payments", []))
        paid = advance + other_pmts
        balance = max(total - paid, 0)
        product_str = "; ".join(
            f"{p.get('name','')} x{p.get('quantity',0)} @ {p.get('price',0)} [{p.get('status','')}]"
            for p in prods
        )
        ws.append([
            o.get("order_no", ""),
            _fmt_dt(o.get("created_at")),
            _fmt_dt(o.get("updated_at")),
            o.get("customer_name", ""),
            o.get("customer_phone", ""),
            o.get("customer_address", ""),
            len(prods),
            product_str,
            round(total, 2),
            round(advance, 2),
            round(other_pmts, 2),
            round(paid, 2),
            round(balance, 2),
            o.get("created_by_name", ""),
            ", ".join(o.get("assigned_user_ids", []) or []),
            o.get("notes", ""),
        ])
    _style_header(ws, len(headers))
    _autosize(ws)

    # Sheet 3 - Order Products (one row per product line item)
    ws = wb.create_sheet("Order Products")
    headers = [
        "Order No", "Order Date", "Customer Name", "Customer Phone",
        "Product Name", "Quantity", "Price (INR)", "Status", "Product Notes", "Product Updated At",
    ]
    ws.append(headers)
    for o in orders:
        for p in o.get("products", []):
            ws.append([
                o.get("order_no", ""),
                _fmt_dt(o.get("created_at")),
                o.get("customer_name", ""),
                o.get("customer_phone", ""),
                p.get("name", ""),
                p.get("quantity", 0),
                round(p.get("price", 0) or 0, 2),
                p.get("status", ""),
                p.get("notes", ""),
                _fmt_dt(p.get("updated_at")),
            ])
    _style_header(ws, len(headers))
    _autosize(ws)

    # Sheet 4 - Payments
    ws = wb.create_sheet("Payments")
    headers = ["Order No", "Customer Name", "Type", "Amount (INR)", "Date", "Recorded By", "Note"]
    ws.append(headers)
    for o in orders:
        if (o.get("advance_paid") or 0) > 0:
            ws.append([
                o.get("order_no", ""),
                o.get("customer_name", ""),
                "Advance",
                round(o.get("advance_paid", 0) or 0, 2),
                _fmt_dt(o.get("created_at")),
                o.get("created_by_name", ""),
                "Initial advance at order creation",
            ])
        for pmt in o.get("payments", []):
            ws.append([
                o.get("order_no", ""),
                o.get("customer_name", ""),
                "Payment",
                round(pmt.get("amount", 0) or 0, 2),
                _fmt_dt(pmt.get("at")),
                pmt.get("by", ""),
                pmt.get("note", ""),
            ])
    _style_header(ws, len(headers))
    _autosize(ws)

    # Sheet 5 - Customers (with balance)
    ws = wb.create_sheet("Customers")
    headers = ["Name", "Phone", "Address", "Orders", "Total Business (INR)", "Total Paid (INR)", "Outstanding Balance (INR)", "Created At", "Last Updated"]
    ws.append(headers)
    # Compute per-customer aggregates
    per_cust = {}
    for o in orders:
        cid = o.get("customer_id")
        if not cid:
            continue
        t = sum((p.get("price", 0) or 0) for p in o.get("products", []))
        pd = (o.get("advance_paid", 0) or 0) + sum(p.get("amount", 0) for p in o.get("payments", []))
        b = max(t - pd, 0)
        agg = per_cust.setdefault(cid, {"orders": 0, "biz": 0.0, "paid": 0.0, "bal": 0.0})
        agg["orders"] += 1
        agg["biz"] += t
        agg["paid"] += pd
        agg["bal"] += b
    for c in customers:
        cid = c.get("id")
        agg = per_cust.get(cid, {"orders": 0, "biz": 0.0, "paid": 0.0, "bal": 0.0})
        ws.append([
            c.get("name", ""),
            c.get("phone", ""),
            c.get("address", ""),
            agg["orders"],
            round(agg["biz"], 2),
            round(agg["paid"], 2),
            round(agg["bal"], 2),
            _fmt_dt(c.get("created_at")),
            _fmt_dt(c.get("updated_at")),
        ])
    _style_header(ws, len(headers))
    _autosize(ws)

    # Sheet 6 - Outstanding Balance (orders with balance > 0)
    ws = wb.create_sheet("Outstanding Balance")
    headers = ["Order No", "Date", "Customer Name", "Customer Phone", "Total (INR)", "Paid (INR)", "Balance (INR)", "Days Old"]
    ws.append(headers)
    now = datetime.now(timezone.utc)
    pending_rows = []
    for o in orders:
        t = sum((p.get("price", 0) or 0) for p in o.get("products", []))
        pd = (o.get("advance_paid", 0) or 0) + sum(p.get("amount", 0) for p in o.get("payments", []))
        b = max(t - pd, 0)
        if b <= 0:
            continue
        created = o.get("created_at")
        days_old = ""
        if isinstance(created, datetime):
            try:
                if created.tzinfo is None:
                    created = created.replace(tzinfo=timezone.utc)
                days_old = (now - created).days
            except Exception:
                days_old = ""
        pending_rows.append([
            o.get("order_no", ""), _fmt_dt(o.get("created_at")),
            o.get("customer_name", ""), o.get("customer_phone", ""),
            round(t, 2), round(pd, 2), round(b, 2), days_old,
        ])
    pending_rows.sort(key=lambda r: r[6], reverse=True)  # highest balance first
    for r in pending_rows:
        ws.append(r)
    _style_header(ws, len(headers))
    _autosize(ws)

    # Sheet 7 - Users
    ws = wb.create_sheet("Users")
    headers = ["Username", "Name", "Role", "Created At"]
    ws.append(headers)
    for u in users:
        ws.append([u.get("username", ""), u.get("name", ""), u.get("role", ""), _fmt_dt(u.get("created_at"))])
    _style_header(ws, len(headers))
    _autosize(ws)

    out = io.BytesIO()
    wb.save(out)
    out.seek(0)
    return out.getvalue()


@app.get("/backup")
@api.get("/backup")
async def export_backup(admin=Depends(require_admin)):
    data = await _build_backup_workbook()
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M-%S")
    filename = f"press-order-book-backup-{stamp}.xlsx"
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )

# ---------- Stats ----------
@app.get("/stats")
@api.get("/stats")
async def stats(user=Depends(get_current_user)):
    q = {} if user.get("role") == "admin" else {"assigned_user_ids": user.get("id")}
    # MongoDB se direct raw orders uthayein (bina kisi string conversion ke)
    orders = await db.orders.find(q).to_list(1000)

    def aggregate(order_list):
        total_orders = len(order_list)
        total_revenue = sum((order_total(o) or 0) for o in order_list)
        total_paid = sum((order_paid(o) or 0) for o in order_list)
        balance = max(total_revenue - total_paid, 0)
        pending = in_progress = delivered = 0
        for o in order_list:
            statuses = [p.get("status") for p in o.get("products", [])]
            if not statuses: continue
            if all(s == "Delivered" for s in statuses): 
                delivered += 1
            elif all(s == "Pending" for s in statuses): 
                pending += 1
            else: 
                in_progress += 1
        return {
            "total_orders": total_orders,
            "total_revenue": total_revenue,
            "total_paid": total_paid,
            "balance_due": balance,
            "pending": pending,
            "in_progress": in_progress,
            "delivered": delivered,
        }

    # Timezone Proof String Matching Logic
    # --- SERVER.PY KE STATS FUNCTION KA AAKHIRI HISSA (ISE REPLACE KARO) ---
    try:
        IST = timezone(timedelta(hours=5, minutes=30))
        today_date_str = datetime.now(IST).strftime("%Y-%m-%d")
        
        today_orders = []
        for o in orders:
            ca = o.get("created_at")
            if not ca: continue
            
            if isinstance(ca, str):
                order_date_str = ca[:10] 
            else:
                if ca.tzinfo is None:
                    ca = ca.replace(tzinfo=timezone.utc)
                ca_ist = ca.astimezone(IST)
                order_date_str = ca_ist.strftime("%Y-%m-%d")
            
            if order_date_str == today_date_str:
                today_orders.append(o)
    except Exception as e:
        print(f"Error in today stats: {e}")
        today_orders = []

    result = aggregate(orders)
    result["today"] = aggregate(today_orders)
    
    # Dashboard se reminders ko poori tarah hatane ke liye (Perfect Spacing)
    result["reminders"] = []
    
    return result
    
# ---------- Init ----------
async def seed_admin():
    if await db.users.count_documents({}) == 0:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "name": "Admin",
            "username": "admin",
            "password_hash": hash_pw("admin123"),
            "role": "admin",
            "created_at": datetime.now(timezone.utc),
        })
        logging.info("Seeded default admin: admin / admin123")
    if not await db.settings.find_one({"id": "default"}):
        await db.settings.insert_one(DEFAULT_SETTINGS.copy())
    else:
        await db.settings.update_one(
            {"id": "default", "app_name": {"$exists": False}},
            {"$set": {"app_name": "Press Order Book"}},
        )

async def migrate_statuses():
    res = await db.orders.update_many(
        {"products.status": "Printing"},
        {"$set": {"products.$[p].status": "Digital Printing"}},
        array_filters=[{"p.status": "Printing"}],
    )
    if res.modified_count:
        logging.info(f"Migrated {res.modified_count} order(s): Printing -> Digital Printing")

    # Migrate Cutting -> Binding
    res = await db.orders.update_many(
        {"products.status": "Cutting"},
        {"$set": {"products.$[p].status": "Binding"}},
        array_filters=[{"p.status": "Cutting"}],
    )
    if res.modified_count:
        logging.info(f"Migrated {res.modified_count} order(s): Cutting -> Binding")

    # Migrate Packing -> Flex
    res = await db.orders.update_many(
        {"products.status": "Packing"},
        {"$set": {"products.$[p].status": "Flex"}},
        array_filters=[{"p.status": "Packing"}],
    )
    if res.modified_count:
        logging.info(f"Migrated {res.modified_count} order(s): Packing -> Flex")

@app.on_event("startup")
async def startup():
    await seed_admin()
    await migrate_statuses()

@app.post("/auth/login")
async def bypass_login(data: LoginIn):
    return await login(data)

@app.get("/stats")
async def bypass_stats(user=Depends(get_current_user)):
    return await stats(user)

@app.get("/orders")
async def bypass_orders(user=Depends(get_current_user)):
    return await list_orders(user)

@app.post("/orders")
async def bypass_create_order(data: OrderCreate, user=Depends(get_current_user)):
    return await create_order(data, user)

@app.middleware("http")
async def add_api_prefix_if_missing(request, call_next):
    if request.url.path.startswith("/auth") or request.url.path.startswith("/orders") or request.url.path.startswith("/stats") or request.url.path.startswith("/customers") or request.url.path.startswith("/settings"):
        request.scope["path"] = f"/api{request.url.path}"
    return await call_next(request)

# --- YAHAN SE COPY KAREIN ---
# Reminders Dismiss aur Restore ka special bypass rule
@app.post("/reminders/dismiss")
@api.post("/reminders/dismiss")
async def bypass_dismiss_reminder(data: DismissIn):
    # Bina kisi strict admin check ke seedha database mein update
    await db.settings.update_one(
        {"id": "default"}, 
        {"$addToSet": {"dismissed_reminders": data.key}}
    )
    return {"ok": True}

@app.post("/reminders/restore")
@api.post("/reminders/restore")
async def bypass_restore_reminder(data: DismissIn):
    await db.settings.update_one(
        {"id": "default"}, 
        {"$pull": {"dismissed_reminders": data.key}}
    )
    return {"ok": True}
# --- COPY YAHAN KHATAM ---

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
