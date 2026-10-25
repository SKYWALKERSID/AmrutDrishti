import ssl
import urllib.request
import json
import re

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def inspect_gis():
    print("=== INSPECTING NWIC GIS MAPSERVER ===")
    url = "https://gis.nwic.in/server/rest/services/NWIC/Groundwater_Stations/MapServer?f=pjson"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            data = resp.read()
            js = json.loads(data)
            print(f"Service Description: {js.get('serviceDescription')}")
            print(f"Layers Count: {len(js.get('layers', []))}")
            for l in js.get("layers", []):
                print(f"  Layer ID {l.get('id')}: {l.get('name')} (defaultVisibility={l.get('defaultVisibility')})")
    except Exception as e:
        print(f"GIS MapServer Error: {e}")

def inspect_nwdp_api_page():
    print("\n=== INSPECTING NWDP API DIRECTORY ===")
    url = "https://nwdp.nwic.gov.in/dataset_api/home_api_page"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
            print(f"Page size: {len(html)} characters")
            
            # Find forms, buttons, links, scripts
            api_links = re.findall(r'href=[\'"]([^\'"]+)[\'"]', html)
            relevant = [l for l in api_links if "api" in l.lower() or "dataset" in l.lower()]
            print(f"Found {len(relevant)} API/dataset links in HTML:")
            for l in relevant[:20]:
                print(f"  - {l}")
            
            # Look for table or cards detailing the 546 APIs
            tables = re.findall(r'<table[^>]*>.*?</table>', html, re.DOTALL | re.IGNORECASE)
            print(f"Found {len(tables)} tables")
            if tables:
                print("Table 0 snippet:", tables[0][:500])
                
            # Search for keyword groundwater or gwl
            gw_mentions = re.findall(r'[^.\n]*ground\s*water[^.\n]*', html, re.IGNORECASE)
            print(f"Groundwater mentions ({len(gw_mentions)}):")
            for m in gw_mentions[:5]:
                print(f"  - {m.strip()}")
                
    except Exception as e:
        print(f"NWDP API Error: {e}")

if __name__ == "__main__":
    inspect_gis()
    inspect_nwdp_api_page()
