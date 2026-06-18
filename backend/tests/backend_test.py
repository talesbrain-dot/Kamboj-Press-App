"""Backend tests for Kamboj Press App - focused on new features:
- /api/customers (total_balance per customer)
- /api/orders/balance/list
- /api/orders/{order_id}/products/{product_id} PATCH (inline status update)
- /api/backup (xlsx download)
"""
import io
import os
import zipfile

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://press-hub-38.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "admin123"}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data
    return data["access_token"]


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---------- Customers total_balance ----------
def test_customers_have_total_balance(auth_headers):
    r = requests.get(f"{API}/customers", headers=auth_headers, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    if data:
        c = data[0]
        assert "total_balance" in c
        assert "total_orders" in c
        assert "total_business" in c
        assert isinstance(c["total_balance"], (int, float))


# ---------- Balance list endpoint ----------
def test_balance_list_shape(auth_headers):
    r = requests.get(f"{API}/orders/balance/list", headers=auth_headers, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    # All returned items should have balance > 0
    for o in data:
        assert "balance" in o and "order_no" in o and "customer_name" in o
        assert o["balance"] > 0, f"order {o.get('order_no')} returned in balance list but balance={o['balance']}"
    # Sorted descending by balance
    bals = [o["balance"] for o in data]
    assert bals == sorted(bals, reverse=True), "balance list not sorted desc"


def test_balance_list_requires_auth():
    r = requests.get(f"{API}/orders/balance/list", timeout=30)
    assert r.status_code in (401, 403)


# ---------- Inline product status update ----------
def _ensure_test_order(auth_headers):
    # Create a fresh order for status update test
    payload = {
        "customer_name": "TEST_StatusCustomer",
        "customer_phone": "9000000111",
        "customer_address": "",
        "products": [
            {"name": "TEST_Item", "quantity": 1, "price": 100.0, "notes": "", "status": "Pending"}
        ],
        "advance_paid": 0,
    }
    r = requests.post(f"{API}/orders", headers=auth_headers, json=payload, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def test_inline_status_update(auth_headers):
    order = _ensure_test_order(auth_headers)
    oid = order["id"]
    pid = order["products"][0]["id"]

    r = requests.patch(
        f"{API}/orders/{oid}/products/{pid}",
        headers=auth_headers,
        json={"status": "Designing"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    updated = r.json()
    prod = next(p for p in updated["products"] if p["id"] == pid)
    assert prod["status"] == "Designing"

    # Verify persistence via GET
    r2 = requests.get(f"{API}/orders/{oid}", headers=auth_headers, timeout=30)
    assert r2.status_code == 200
    prod2 = next(p for p in r2.json()["products"] if p["id"] == pid)
    assert prod2["status"] == "Designing"

    # cleanup
    requests.delete(f"{API}/orders/{oid}", headers=auth_headers, timeout=30)


def test_inline_status_invalid(auth_headers):
    order = _ensure_test_order(auth_headers)
    oid = order["id"]
    pid = order["products"][0]["id"]
    r = requests.patch(
        f"{API}/orders/{oid}/products/{pid}",
        headers=auth_headers,
        json={"status": "Bogus"},
        timeout=30,
    )
    assert r.status_code == 400
    requests.delete(f"{API}/orders/{oid}", headers=auth_headers, timeout=30)


# ---------- Backup (xlsx) ----------
def test_backup_returns_xlsx(auth_headers):
    r = requests.get(f"{API}/backup", headers=auth_headers, timeout=60)
    assert r.status_code == 200, r.text
    ctype = r.headers.get("content-type", "")
    assert "spreadsheetml.sheet" in ctype, f"unexpected content-type: {ctype}"
    cd = r.headers.get("content-disposition", "")
    assert ".xlsx" in cd, f"content-disposition missing xlsx: {cd}"
    content = r.content
    # xlsx is a zip - must start with PK
    assert content[:2] == b"PK", "Backup content is not a valid zip/xlsx file"
    # Should be openable as zip with expected xlsx parts
    with zipfile.ZipFile(io.BytesIO(content)) as zf:
        names = zf.namelist()
        assert any(n.startswith("xl/") for n in names), "Not a valid xlsx structure"


def test_backup_requires_admin():
    r = requests.get(f"{API}/backup", timeout=30)
    assert r.status_code in (401, 403)


# ---------- Regression: dashboard / stats / login ----------
def test_stats_endpoint(auth_headers):
    r = requests.get(f"{API}/stats", headers=auth_headers, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert "total_orders" in data or "totals" in data or isinstance(data, dict)


def test_orders_list(auth_headers):
    r = requests.get(f"{API}/orders", headers=auth_headers, timeout=30)
    assert r.status_code == 200
    assert isinstance(r.json(), list)
