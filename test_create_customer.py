import requests
import sys
url="http://localhost:8000/api/method/small_erp.api.auth.login_to_get_keys"
res=requests.post(url, json={"usr":"Administrator","pwd":"admin"}, headers={"Host":"small.localhost"})
if res.status_code != 200:
    print(res.status_code, res.text)
    sys.exit(1)
data=res.json()["message"]
auth={"Authorization": f"token {data['api_key']}:{data['api_secret']}", "Host": "small.localhost"}
res2 = requests.post("http://localhost:8000/api/resource/Customer", json={"customer_name":"API Test Cust", "customer_group": "General", "customer_type":"Company"}, headers=auth)
print(res2.status_code, res2.text)
