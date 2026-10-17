import urllib.request
import ssl
import json

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# Query packages matching ground water level
url = "https://nwdp.nwic.gov.in/api/3/action/package_search?q=name:ground-water-level*&rows=50"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})

try:
    with urllib.request.urlopen(req, context=ctx, timeout=20) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        results = data.get('result', {}).get('results', [])
        print(f"Total packages matching name:ground-water-level*: {len(results)}")
        for r in results:
            title = r.get('title')
            name = r.get('name')
            print(f"- {title} (slug: {name})")
            for res in r.get('resources', []):
                r_name = res.get('name', '')
                r_url = res.get('url', '')
                if any(st in r_name.lower() or st in r_url.lower() for st in ['uttar', 'up', 'sikkim', 'assam']):
                    print(f"    * {r_name} | {r_url}")
except Exception as e:
    print("Error:", e)
