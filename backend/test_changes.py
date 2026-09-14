import urllib.request
import urllib.error
import json

# 1. Test Project Manager blocked from modifying feature flags (403 Forbidden)
data = json.dumps({'is_p2_enabled': True}).encode()
req = urllib.request.Request(
    'http://127.0.0.1:8000/api/projects/tenant-settings',
    data=data,
    headers={'Content-Type': 'application/json', 'X-User-Role': 'project_manager'},
    method='PUT'
)
try:
    urllib.request.urlopen(req)
    print('RBAC TEST: FAILED (PM was allowed)')
except urllib.error.HTTPError as e:
    print(f'RBAC TEST: PASSED (PM blocked with status {e.code})')

# 2. Test Admin allowed to modify feature flags (200 OK)
req_admin = urllib.request.Request(
    'http://127.0.0.1:8000/api/projects/tenant-settings',
    data=data,
    headers={'Content-Type': 'application/json', 'X-User-Role': 'admin'},
    method='PUT'
)
with urllib.request.urlopen(req_admin) as resp:
    res_data = json.loads(resp.read().decode())
    print(f'ADMIN UPDATE TEST: PASSED (Status {resp.status}, P2 is {res_data.get("is_p2_enabled")})')

# Reset P2 back to False for clean baseline
data_reset = json.dumps({'is_p2_enabled': False}).encode()
req_reset = urllib.request.Request(
    'http://127.0.0.1:8000/api/projects/tenant-settings',
    data=data_reset,
    headers={'Content-Type': 'application/json', 'X-User-Role': 'admin'},
    method='PUT'
)
with urllib.request.urlopen(req_reset) as resp:
    print('P2 RESET TEST: PASSED')
