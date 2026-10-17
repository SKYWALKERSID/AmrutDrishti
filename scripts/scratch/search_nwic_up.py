import urllib.request
import ssl
import json

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

url = "https://nwdp.nwic.gov.in/api/3/action/package_search?q=ground+water+level+uttar+pradesh&rows=100"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})

try:
    with urllib.request.urlopen(req, context=ctx, timeout=20) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        results = data.get('result', {}).get('results', [])
        print(f"Total datasets found: {len(results)}")
        for r in results:
            title = r.get('title', '')
            name = r.get('name', '')
            resources = r.get('resources', [])
            for res in resources:
                res_name = res.get('name', '')
                res_url = res.get('url', '')
                res_format = res.get('format', '')
                if any(k in res_name.lower() or k in res_url.lower() for k in ['gwl', 'telemetry', 'manual', 'quarterly', 'monthly']) and 'uttar' in (title + res_name + res_url).lower():
                    print(f"\n[MATCH] {title} | {name}")
                    print(f"   Resource: {res_name} | {res_format} | {res_url}")

except Exception as e:
    print("Error querying NWIC:", e)
