"""
Search NWIC CKAN for all groundwater telemetry packages.
"""
import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

base_url = "https://nwdp.nwic.gov.in/api/3/action/package_search"
q = urllib.parse.quote("Ground Water Level Telemetry")
url = f"{base_url}?q={q}&rows=50"

req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, timeout=15, context=ctx) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        results = data.get('result', {}).get('results', [])
        print(f"Total packages found for 'Ground Water Level Telemetry': {len(results)}\n")
        for p in results:
            title = p.get('title', '')
            name = p.get('name', '')
            resources = p.get('resources', [])
            print(f"- Title: {title} (name: {name})")
            for r in resources:
                print(f"    Res: {r.get('name')} | Format: {r.get('format')} | URL: {r.get('url')}")
except Exception as e:
    print(f"Query error: {e}")
