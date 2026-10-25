"""Inspect header and sample rows from all 10 NWDP state telemetry resources."""
import json
import ssl
import urllib.request

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

with open('data/sources/nwdp_telemetry_registry.json', 'r', encoding='utf-8') as f:
    registry = json.load(f)

print(f"Loaded registry for {len(registry)} states.\n")

for state, pkg in registry.items():
    print(f"=== {state} ===")
    resources = pkg.get('resources', [])
    for r in resources:
        name = r.get('name')
        url = r.get('url')
        print(f"  Resource: {name}")
        print(f"  URL: {url}")
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
                chunk = resp.read(1024).decode('utf-8', errors='ignore')
                lines = [line.strip() for line in chunk.splitlines() if line.strip()]
                if lines:
                    print(f"    Header: {lines[0][:100]}...")
                    if len(lines) > 1:
                        print(f"    Sample Row: {lines[1][:100]}...")
                    else:
                        print("    Sample Row: [Empty / Header only]")
                else:
                    print("    [Zero length file]")
        except Exception as e:
            print(f"    [Fetch Error]: {e}")
    print()
