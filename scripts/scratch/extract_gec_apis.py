import urllib.request
import ssl
import re

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

js_url = 'https://ingres.iith.ac.in/main.193f10a4de7857b61f31.js'
req = urllib.request.Request(js_url, headers={'User-Agent': 'Mozilla/5.0'})
js_text = urllib.request.urlopen(req, context=ctx).read().decode('utf-8', errors='ignore')

matches = set(re.findall(r'(/api/[a-zA-Z0-9_/]+)', js_text))
print(f"Found {len(matches)} API endpoints:")
for m in sorted(matches):
    if 'gec' in m.lower():
        print(" ", m)

