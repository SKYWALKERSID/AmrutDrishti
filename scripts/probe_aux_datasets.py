import ssl
import urllib.request
import json

ctx = ssl._create_unverified_context()

def check_package(name):
    url = f"https://nwdp.nwic.gov.in/api/3/action/package_show?id={name}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("success"):
                res = data["result"]
                print(f"[{name}] Title: {res.get('title')}")
                print(f"Total resources: {len(res.get('resources', []))}")
                for r in res.get("resources", [])[:6]:
                    print(f"  - {r.get('name')} | ID: {r.get('id')} | Format: {r.get('format')} | URL: {r.get('url')}")
            else:
                print(f"[{name}] Failure: {data}")
    except Exception as e:
        print(f"[{name}] Error: {e}")

if __name__ == "__main__":
    check_package("gwl-manual-quarterly-central-ground-water-board-department")
    print("-" * 60)
    check_package("rainfall-daily-imd")
