import requests

s = requests.Session()
s.headers.update({'Host': 'small.localhost'})

# Login
res = s.post('http://localhost:8000/api/method/login', data={'usr': 'smb@example.com', 'pwd': 'password'})
print('Login Status:', res.status_code)
print('Login Response:', res.json())

# Test /app
res = s.get('http://localhost:8000/app', allow_redirects=False)
print('/app Status:', res.status_code)
if res.status_code in (301, 302):
    print('/app Redirect:', res.headers.get('Location'))

# Test /ops
res = s.get('http://localhost:8000/ops', allow_redirects=False)
print('/ops Status:', res.status_code)
if res.status_code in (301, 302):
    print('/ops Redirect:', res.headers.get('Location'))
else:
    print('/ops content:', res.text[:100])

