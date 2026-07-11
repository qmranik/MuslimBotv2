import requests
import json
import sys

BASE_URL = "http://localhost:8000"
USER = "Administrator"
PASSWORD = "admin"

def test_login():
    url = f"{BASE_URL}/api/method/small_erp.api.auth.login_to_get_keys"
    payload = {"usr": USER, "pwd": PASSWORD}
    print(f"Testing {url}")
    # First successful login
    res = requests.post(url, json=payload, headers={"Host": "small.localhost"})
    if res.status_code != 200:
        print(f"Failed to get 200 on first login, got {res.status_code}")
        print(res.text)
        return False
    data = res.json()
    if 'message' not in data or 'api_key' not in data['message']:
        print("Missing api_key in response")
        return False
    
    api_key = data['message']['api_key']
    api_secret = data['message']['api_secret']
    print(f"Success! Got keys: {api_key}:{api_secret}")
    
    print("Hammering to hit rate limit...")
    rate_limited = False
    for i in range(12):
        res_limit = requests.post(url, json=payload, headers={"Host": "small.localhost"})
        if res_limit.status_code in [429, 417]:
            print(f"Rate limited hit on request {i+1} (Status {res_limit.status_code})")
            rate_limited = True
            break
    
    if not rate_limited:
        print("Failed to hit rate limit")
        return False

    print("Testing API call with keys...")
    auth_header = {"Authorization": f"token {api_key}:{api_secret}", "Host": "small.localhost"}
    res_auth = requests.get(f"{BASE_URL}/api/method/frappe.auth.get_logged_user", headers=auth_header)
    if res_auth.status_code != 200:
        print(f"Auth call failed: {res_auth.status_code}")
        return False
    
    print("Testing revoke_keys...")
    res_revoke = requests.post(f"{BASE_URL}/api/method/small_erp.api.auth.revoke_keys", headers=auth_header)
    if res_revoke.status_code != 200:
        print(f"Revoke failed: {res_revoke.status_code}")
        return False
    
    print("Testing API call after revoke...")
    res_auth_after = requests.get(f"{BASE_URL}/api/method/frappe.auth.get_logged_user", headers=auth_header)
    if res_auth_after.status_code in [401, 403]:
        print(f"Auth call after revoke successfully blocked: {res_auth_after.status_code}")
    else:
        print(f"Auth call after revoke unexpectedly returned {res_auth_after.status_code}")
        return False
        
    return True

if __name__ == "__main__":
    success = test_login()
    if success:
        print("ALL SILO 1 AUTH TESTS PASSED")
    else:
        sys.exit(1)
