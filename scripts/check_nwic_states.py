"""
Search NWIC specifically for Punjab, Haryana, Rajasthan, and Sikkim groundwater.
"""
import urllib.request
import urllib.parse
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

base_url = "https://nwdp.nwic.gov.in/api/3/action/package_search"

for st in ['punjab', 'haryana', 'rajasthan', 'sikkim']:
    q = urllib.parse.quote(f"ground water {st}")
    url = f"{base_url}?q={q}&rows=10"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            results = data.get('result', {}).get('results', [])
            print(f"\nResults for {st.upper()} ({len(results)} found):")
            for p in results:
                print(f"  * {p.get('title')} ({p.get('name')})")
                for r in p.get('resources', []):
                    print(f"      - Res: {r.get('name')} | URL: {r.get('url')}")
    except Exception as e:
        print(f"Error querying {st}: {e}")
