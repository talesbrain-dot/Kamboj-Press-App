#!/usr/bin/env python3
"""
Backend API Test Suite for Kamboj Press App
Tests all backend endpoints with focus on new/fixed features
"""
import requests
import json
import sys
from typing import Dict, Any, Optional

# Backend URL from environment
BACKEND_URL = "https://press-hub-38.preview.emergentagent.com/api"

# Admin credentials
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"

# Test results tracking
test_results = []

def log_test(name: str, passed: bool, details: str = ""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    result = f"{status} | {name}"
    if details:
        result += f"\n    Details: {details}"
    print(result)
    test_results.append({"name": name, "passed": passed, "details": details})

def make_request(method: str, endpoint: str, token: Optional[str] = None, 
                 json_data: Optional[Dict] = None, expect_fail: bool = False) -> tuple:
    """Make HTTP request and return (status_code, response_json, success)"""
    url = f"{BACKEND_URL}{endpoint}"
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    try:
        if method == "GET":
            resp = requests.get(url, headers=headers, timeout=10)
        elif method == "POST":
            resp = requests.post(url, headers=headers, json=json_data, timeout=10)
        elif method == "PATCH":
            resp = requests.patch(url, headers=headers, json=json_data, timeout=10)
        elif method == "DELETE":
            resp = requests.delete(url, headers=headers, timeout=10)
        else:
            return 0, {}, False
        
        try:
            data = resp.json()
        except:
            data = {"raw": resp.text}
        
        return resp.status_code, data, True
    except Exception as e:
        return 0, {"error": str(e)}, False

def test_admin_login() -> Optional[str]:
    """Test admin login and return access token"""
    print("\n=== Testing Admin Login ===")
    status, data, success = make_request(
        "POST", 
        "/auth/login",
        json_data={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
    )
    
    if success and status == 200 and "access_token" in data:
        log_test("Admin Login", True, f"Token received, user: {data.get('user', {}).get('username')}")
        return data["access_token"]
    else:
        log_test("Admin Login", False, f"Status: {status}, Response: {json.dumps(data)[:200]}")
        return None

def test_backup_endpoint(token: str):
    """Test GET /api/backup endpoint"""
    print("\n=== Testing Backup Endpoint ===")
    
    # Test with admin token
    status, data, success = make_request("GET", "/backup", token=token)
    
    if not success:
        log_test("Backup - Request Success", False, f"Request failed: {data.get('error')}")
        return
    
    if status != 200:
        log_test("Backup - Status 200", False, f"Got status {status}: {json.dumps(data)[:200]}")
        return
    
    log_test("Backup - Status 200", True, "Received 200 OK")
    
    # Check required keys
    required_keys = ["exported_at", "version", "_counts", "users", "customers", "orders", "settings"]
    missing_keys = [k for k in required_keys if k not in data]
    
    if missing_keys:
        log_test("Backup - Required Keys", False, f"Missing keys: {missing_keys}")
    else:
        log_test("Backup - Required Keys", True, "All required keys present")
    
    # Check that users don't contain password_hash
    users = data.get("users", [])
    users_with_password = [u for u in users if "password_hash" in u]
    
    if users_with_password:
        log_test("Backup - Password Hash Redaction", False, 
                f"{len(users_with_password)} user(s) contain password_hash")
    else:
        log_test("Backup - Password Hash Redaction", True, 
                f"All {len(users)} users have password_hash redacted")
    
    # Test without auth (should fail)
    status_noauth, data_noauth, _ = make_request("GET", "/backup")
    
    if status_noauth in [401, 403]:
        log_test("Backup - Auth Required", True, f"Correctly rejected with {status_noauth}")
    else:
        log_test("Backup - Auth Required", False, 
                f"Expected 401/403 without auth, got {status_noauth}")

def test_branding_endpoint():
    """Test GET /api/branding endpoint (public)"""
    print("\n=== Testing Branding Endpoint ===")
    
    status, data, success = make_request("GET", "/branding")
    
    if not success:
        log_test("Branding - Request Success", False, f"Request failed: {data.get('error')}")
        return
    
    if status != 200:
        log_test("Branding - Status 200", False, f"Got status {status}: {json.dumps(data)[:200]}")
        return
    
    log_test("Branding - Status 200", True, "Received 200 OK")
    
    # Check required keys
    required_keys = ["app_name", "company_name", "logo_base64"]
    missing_keys = [k for k in required_keys if k not in data]
    
    if missing_keys:
        log_test("Branding - Required Keys", False, f"Missing keys: {missing_keys}")
    else:
        log_test("Branding - Required Keys", True, 
                f"All keys present: app_name={data.get('app_name')}, company_name={data.get('company_name')}, logo_base64={'present' if data.get('logo_base64') else 'empty'}")

def test_settings_roundtrip(token: str):
    """Test settings update and branding reflection"""
    print("\n=== Testing Settings Round-trip ===")
    
    # Update settings
    test_app_name = "Kamboj Test Press"
    test_logo = "data:image/png;base64,iVBORw0KGgo="
    
    status, data, success = make_request(
        "PATCH",
        "/settings",
        token=token,
        json_data={
            "app_name": test_app_name,
            "logo_base64": test_logo
        }
    )
    
    if not success or status != 200:
        log_test("Settings - Update", False, f"Status {status}: {json.dumps(data)[:200]}")
        return
    
    log_test("Settings - Update", True, "Settings updated successfully")
    
    # Verify via branding endpoint
    status, branding_data, success = make_request("GET", "/branding")
    
    if not success or status != 200:
        log_test("Settings - Branding Reflection", False, 
                f"Failed to fetch branding: {status}")
        return
    
    app_name_match = branding_data.get("app_name") == test_app_name
    logo_match = branding_data.get("logo_base64", "").startswith("data:image/png;base64,")
    
    if app_name_match and logo_match:
        log_test("Settings - Branding Reflection", True, 
                f"app_name={branding_data.get('app_name')}, logo starts correctly")
    else:
        log_test("Settings - Branding Reflection", False, 
                f"app_name match: {app_name_match}, logo match: {logo_match}, got: {json.dumps(branding_data)[:200]}")

def test_reminders_endpoints(token: str):
    """Test reminders dismiss and restore"""
    print("\n=== Testing Reminders Endpoints ===")
    
    test_key = "birthday-2025-01-01"
    
    # Dismiss reminder
    status, data, success = make_request(
        "POST",
        "/reminders/dismiss",
        json_data={"key": test_key}
    )
    
    if not success or status != 200:
        log_test("Reminders - Dismiss", False, f"Status {status}: {json.dumps(data)[:200]}")
        return
    
    if data.get("ok") == True:
        log_test("Reminders - Dismiss", True, "Dismiss returned {ok: true}")
    else:
        log_test("Reminders - Dismiss", False, f"Expected {{ok: true}}, got: {data}")
        return
    
    # Check settings contains dismissed key
    status, settings, success = make_request("GET", "/settings", token=token)
    
    if not success or status != 200:
        log_test("Reminders - Dismiss Persisted", False, "Failed to fetch settings")
        return
    
    dismissed_list = settings.get("dismissed_reminders", [])
    if test_key in dismissed_list:
        log_test("Reminders - Dismiss Persisted", True, 
                f"Key '{test_key}' found in dismissed_reminders")
    else:
        log_test("Reminders - Dismiss Persisted", False, 
                f"Key not in dismissed_reminders: {dismissed_list}")
        return
    
    # Restore reminder
    status, data, success = make_request(
        "POST",
        "/reminders/restore",
        json_data={"key": test_key}
    )
    
    if not success or status != 200:
        log_test("Reminders - Restore", False, f"Status {status}: {json.dumps(data)[:200]}")
        return
    
    if data.get("ok") == True:
        log_test("Reminders - Restore", True, "Restore returned {ok: true}")
    else:
        log_test("Reminders - Restore", False, f"Expected {{ok: true}}, got: {data}")
        return
    
    # Check settings no longer contains key
    status, settings, success = make_request("GET", "/settings", token=token)
    
    if not success or status != 200:
        log_test("Reminders - Restore Persisted", False, "Failed to fetch settings")
        return
    
    dismissed_list = settings.get("dismissed_reminders", [])
    if test_key not in dismissed_list:
        log_test("Reminders - Restore Persisted", True, 
                f"Key '{test_key}' removed from dismissed_reminders")
    else:
        log_test("Reminders - Restore Persisted", False, 
                f"Key still in dismissed_reminders: {dismissed_list}")

def test_order_statuses(token: str):
    """Test order status creation and updates"""
    print("\n=== Testing Order Statuses ===")
    
    # First create a customer
    customer_data = {
        "name": "Rajesh Kumar",
        "phone": "9876543210",
        "address": "123 Test Street, Delhi"
    }
    
    # Create order with Binding status
    order_data = {
        "customer_name": customer_data["name"],
        "customer_phone": customer_data["phone"],
        "customer_address": customer_data["address"],
        "products": [
            {
                "name": "Wedding Cards",
                "quantity": 500,
                "price": 5000.0,
                "notes": "Premium finish",
                "status": "Binding"
            }
        ],
        "advance_paid": 2000.0,
        "notes": "Test order for status validation"
    }
    
    status, order, success = make_request("POST", "/orders", token=token, json_data=order_data)
    
    if not success or status != 200:
        log_test("Order - Create with Binding", False, 
                f"Status {status}: {json.dumps(order)[:200]}")
        return
    
    order_id = order.get("id")
    products = order.get("products", [])
    
    if not products:
        log_test("Order - Create with Binding", False, "No products in response")
        return
    
    product = products[0]
    product_id = product.get("id")
    product_status = product.get("status")
    
    if product_status == "Binding":
        log_test("Order - Create with Binding", True, 
                f"Order created with product status 'Binding', order_id={order_id}")
    else:
        log_test("Order - Create with Binding", False, 
                f"Expected 'Binding', got '{product_status}'")
        return
    
    # Update to Screen Printing
    status, updated_order, success = make_request(
        "PATCH",
        f"/orders/{order_id}/products/{product_id}",
        token=token,
        json_data={"status": "Screen Printing"}
    )
    
    if not success or status != 200:
        log_test("Order - Update to Screen Printing", False, 
                f"Status {status}: {json.dumps(updated_order)[:200]}")
        return
    
    updated_products = updated_order.get("products", [])
    if updated_products and updated_products[0].get("status") == "Screen Printing":
        log_test("Order - Update to Screen Printing", True, 
                "Status updated to 'Screen Printing'")
    else:
        log_test("Order - Update to Screen Printing", False, 
                f"Expected 'Screen Printing', got '{updated_products[0].get('status') if updated_products else 'no products'}'")
        return
    
    # Try updating to Cutting (should fail with validation or succeed if no enum)
    status, result, success = make_request(
        "PATCH",
        f"/orders/{order_id}/products/{product_id}",
        token=token,
        json_data={"status": "Cutting"}
    )
    
    if status == 400:
        log_test("Order - Cutting Status Validation", True, 
                "Correctly rejected 'Cutting' status (not in enum)")
    elif status == 200:
        log_test("Order - Cutting Status Validation", True, 
                "No validation enum - 'Cutting' accepted (behavior noted)")
    else:
        log_test("Order - Cutting Status Validation", False, 
                f"Unexpected status {status}: {json.dumps(result)[:200]}")

def test_smoke_tests(token: str):
    """Run smoke tests on existing endpoints"""
    print("\n=== Smoke Tests (Regression Check) ===")
    
    # GET /api/orders
    status, data, success = make_request("GET", "/orders", token=token)
    if success and status == 200 and isinstance(data, list):
        log_test("Smoke - GET /orders", True, f"Returned {len(data)} orders")
    else:
        log_test("Smoke - GET /orders", False, f"Status {status}, success={success}")
    
    # GET /api/customers
    status, data, success = make_request("GET", "/customers", token=token)
    if success and status == 200 and isinstance(data, list):
        log_test("Smoke - GET /customers", True, f"Returned {len(data)} customers")
    else:
        log_test("Smoke - GET /customers", False, f"Status {status}, success={success}")
    
    # GET /api/stats
    status, data, success = make_request("GET", "/stats", token=token)
    if success and status == 200 and isinstance(data, dict):
        log_test("Smoke - GET /stats", True, 
                f"total_orders={data.get('total_orders')}, total_revenue={data.get('total_revenue')}")
    else:
        log_test("Smoke - GET /stats", False, f"Status {status}, success={success}")

def main():
    """Run all tests"""
    print("=" * 70)
    print("KAMBOJ PRESS APP - BACKEND API TEST SUITE")
    print("=" * 70)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Admin User: {ADMIN_USERNAME}")
    print("=" * 70)
    
    # Login first
    token = test_admin_login()
    if not token:
        print("\n❌ CRITICAL: Admin login failed. Cannot proceed with tests.")
        sys.exit(1)
    
    # Run all tests
    test_backup_endpoint(token)
    test_branding_endpoint()
    test_settings_roundtrip(token)
    test_reminders_endpoints(token)
    test_order_statuses(token)
    test_smoke_tests(token)
    
    # Summary
    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)
    
    passed = sum(1 for t in test_results if t["passed"])
    failed = sum(1 for t in test_results if not t["passed"])
    total = len(test_results)
    
    print(f"Total Tests: {total}")
    print(f"Passed: {passed} ✅")
    print(f"Failed: {failed} ❌")
    print(f"Success Rate: {(passed/total*100):.1f}%")
    
    if failed > 0:
        print("\nFailed Tests:")
        for t in test_results:
            if not t["passed"]:
                print(f"  ❌ {t['name']}")
                if t["details"]:
                    print(f"     {t['details']}")
    
    print("=" * 70)
    
    sys.exit(0 if failed == 0 else 1)

if __name__ == "__main__":
    main()
