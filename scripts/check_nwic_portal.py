"""
Investigate NWIC / India-WRIS CKAN API for DWLR Telemetry datasets across 8 states.
NWIC portal runs CKAN: https://nwdp.nwic.gov.in/api/3/action/package_search
"""
import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

states = [
    'punjab', 'haryana', 'rajasthan', 'uttar pradesh', 
    'assam', 'arunachal pradesh', 'sikkim', 'madhya pradesh'
]

print("Searching NWIC CKAN API (nwdp.nwic.gov.in)...")

base_url = "https://nwdp.nwic.gov.in/api/3/action/package_search"

for st in states:
    try:
        q = urllib.parse.quote(f"groundwater telemetry {st}")
        url = f"{base_url}?q={q}&rows=5"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            results = data.get('result', {}).get('results', [])
            print(f"\n[NWIC] State: {st.title()} -> Found {len(results)} packages:")
            for p in results[:3]:
                print(f"  - Title: {p.get('title')}")
                print(f"    Name: {p.get('name')}")
                for r in p.get('resources', [])[:2]:
                    print(f"      Resource: {r.get('name')} | Format: {r.get('format')} | URL: {r.get('url')[:80]}...")
    except Exception as e:
        print(f"\n[NWIC] State: {st.title()} -> Query failed: {e}")
