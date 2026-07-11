import requests

s = requests.Session()
s.headers.update({'X-Frappe-Site-Name': 'small.localhost'})

try:
    res = s.post('http://localhost:3000/api/method/login', data={'usr': 'smb@example.com', 'pwd': 'password'})
    print('Proxy Login Status:', res.status_code)
    print('Proxy Login Response:', res.text)
except Exception as e:
    print('Error:', e)
