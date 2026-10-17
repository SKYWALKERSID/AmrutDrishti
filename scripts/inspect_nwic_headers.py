"""
Inspect live remote headers from NWIC datasets for Assam and UP.
"""
import urllib.request
import ssl
import io
import csv

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

urls = {
    'Assam DWLR Telemetry': 'https://nwdp.nwic.gov.in/dataset/276d9f85-1117-4af0-8f57-7c87f717d73e/resource/8e2554f2-7ccc-4dd9-b4a7-5b9fb835c650/download/gwl_tel_6_hourly_assam_as_2021_2025.csv',
    'UP Manual Groundwater': 'https://nwdp.nwic.gov.in/dataset/c248b509-769e-43e4-953c-409bc715d5e8/resource/e5831942-ac52-4025-a69e-0fc2f725446d/download/gwl_manual_quarterly_upgw_up_1991_2020.csv',
    'Rajasthan GW Portal': 'https://nwdp.nwic.gov.in/dataset/ad13ff8c-dd96-41ef-a3eb-0df94929f294/resource/95139a81-1835-4c43-82b1-d36e9d16b0e4/download/ground_water_level_manual_quarterly_rajasthan_2011-2024.csv'
}

for name, url in urls.items():
    print(f"\n--- Testing {name} ---")
    print(f"URL: {url}")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15, context=ctx) as resp:
            # Read first 4KB to inspect header and sample rows
            sample_bytes = resp.read(4096)
            text = sample_bytes.decode('utf-8', errors='ignore')
            lines = text.split('\n')
            print(f"Header: {lines[0]}")
            print("Sample Rows:")
            for l in lines[1:4]:
                if l.strip():
                    print(f"  {l}")
    except Exception as e:
        print(f"Failed to fetch sample: {e}")
