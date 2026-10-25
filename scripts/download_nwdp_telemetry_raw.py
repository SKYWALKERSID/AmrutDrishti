"""
JAL DRISHTI — Official NWDP Telemetry Ingestion & Atomic Persistence Pipeline
=============================================================================
Downloads, verifies, and atomically persists the 18 approved CSV files across the
9 retained states directly into `data/sources/nwdp_telemetry_raw/`.

Requirements enforced:
1. Strict TLS verification (default ssl context).
2. Streaming download with constant chunk size (no loading 300MB files into RAM).
3. Temporary file write (.tmp) -> CSV schema verification -> atomic rename.
4. If a download or validation fails, previously valid destination is preserved.
5. Emits machine-readable nwdp_telemetry_download_manifest.json with:
   - URL, timestamp, byte count, sha256, row count, timestamp range, validation outcome.
"""

import os
import sys
import urllib.request
import hashlib
import csv
import tempfile
import json
from datetime import datetime
from typing import List, Dict, Any, Optional

WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUTPUT_DIR = os.path.join(WORKSPACE_ROOT, 'data', 'sources', 'nwdp_telemetry_raw')

APPROVED_SOURCES = [
    # 1. Karnataka
    ('Karnataka', '2021-2025', 'gwl_tel_6_hourly_cgwb_ka_2021_2025.csv', 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/cd3f04e8-966a-41d3-9c18-f0122a2f3a50/download/gwl_tel_6_hourly_cgwb_ka_2021_2025.csv'),
    ('Karnataka', '2026-2030', 'gwl_tel_6_hourly_cgwb_ka_2026_2030.csv', 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/b9a76d29-078e-4551-8092-e22f0e60bb45/download/gwl_tel_6_hourly_cgwb_ka_2026_2030.csv'),
    # 2. Telangana
    ('Telangana', '2021-2025', 'gwl_tel_6_hourly_cgwb_ts_2021_2025.csv', 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/bc5a9d1c-1f3b-4629-9cfb-0d1ccc9ac81f/download/gwl_tel_6_hourly_cgwb_ts_2021_2025.csv'),
    ('Telangana', '2026-2030', 'gwl_tel_6_hourly_cgwb_ts_2026_2030.csv', 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/137d0a1c-8fe0-4bb1-97a8-983c28ec96db/download/gwl_tel_6_hourly_cgwb_ts_2026_2030.csv'),
    # 3. Tamil Nadu
    ('Tamil Nadu', '2021-2025', 'gwl_tel_6_hourly_cgwb_tn_2021_2025.csv', 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/e68634e0-07e7-4f64-9c08-0808dba2c445/download/gwl_tel_6_hourly_cgwb_tn_2021_2025.csv'),
    ('Tamil Nadu', '2026-2030', 'gwl_tel_6_hourly_cgwb_tn_2026_2030.csv', 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/3bd0c6d5-dd9b-4c07-9c60-6410c1c6bd56/download/gwl_tel_6_hourly_cgwb_tn_2026_2030.csv'),
    # 4. Madhya Pradesh
    ('Madhya Pradesh', '2021-2025', 'gwl_tel_6_hourly_cgwb_mp_2021_2025.csv', 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/acb2cc5c-4182-4aa9-8f47-7cd0bb63fc57/download/gwl_tel_6_hourly_cgwb_mp_2021_2025.csv'),
    ('Madhya Pradesh', '2026-2030', 'gwl_tel_6_hourly_cgwb_mp_2026_2030.csv', 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/ad5b97a5-9c42-443b-8069-e1c33875239c/download/gwl_tel_6_hourly_cgwb_mp_2026_2030.csv'),
    # 5. Rajasthan
    ('Rajasthan', '2021-2025', 'gwl_tel_6_hourly_cgwb_rj_2021_2025.csv', 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/467fe983-e1f0-4428-91b7-0ade87b39f6d/download/gwl_tel_6_hourly_cgwb_rj_2021_2025.csv'),
    ('Rajasthan', '2026-2030', 'gwl_tel_6_hourly_cgwb_rj_2026_2030.csv', 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/931ff862-f13e-4754-83f9-55e0dc894f2d/download/gwl_tel_6_hourly_cgwb_rj_2026_2030.csv'),
    # 6. Punjab
    ('Punjab', '2021-2025', 'gwl_tel_6_hourly_cgwb_pb_2021_2025.csv', 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/2b3bfc59-e5ca-419b-b3c8-6133da16f2f7/download/gwl_tel_6_hourly_cgwb_pb_2021_2025.csv'),
    ('Punjab', '2026-2030', 'gwl_tel_6_hourly_cgwb_pb_2026_2030.csv', 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/8d6526d8-e33d-4401-bea1-e34d259d7070/download/gwl_tel_6_hourly_cgwb_pb_2026_2030.csv'),
    # 7. Haryana
    ('Haryana', '2021-2025', 'gwl_tel_6_hourly_cgwb_hr_2021_2025.csv', 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/fc883e0c-c594-4ef7-9fef-c3e0d0cc25c2/download/gwl_tel_6_hourly_cgwb_hr_2021_2025.csv'),
    ('Haryana', '2026-2030', 'gwl_tel_6_hourly_cgwb_hr_2026_2030.csv', 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/bfc07a76-e85b-4e35-89d6-f707fb3a3128/download/gwl_tel_6_hourly_cgwb_hr_2026_2030.csv'),
    # 8. Meghalaya
    ('Meghalaya', '2021-2025', 'gwl_tel_6_hourly_cgwb_ml_2021_2025.csv', 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/82d41fe2-ef41-4dbd-8ee2-4323bf22c554/download/gwl_tel_6_hourly_cgwb_ml_2021_2025.csv'),
    ('Meghalaya', '2026-2030', 'gwl_tel_6_hourly_cgwb_ml_2026_2030.csv', 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/5839112c-afb1-472e-9326-6eaa23c9a12f/download/gwl_tel_6_hourly_cgwb_ml_2026_2030.csv'),
    # 9. Tripura
    ('Tripura', '2021-2025', 'gwl_tel_6_hourly_cgwb_tr_2021_2025.csv', 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/440d0737-a937-446b-843d-89acb6f23379/download/gwl_tel_6_hourly_cgwb_tr_2021_2025.csv'),
    ('Tripura', '2026-2030', 'gwl_tel_6_hourly_cgwb_tr_2026_2030.csv', 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/cd023229-a909-4b92-b5e0-5b2f5a34f850/download/gwl_tel_6_hourly_cgwb_tr_2026_2030.csv'),
]

def download_and_verify_all(force: bool = False):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    manifest_entries: List[Dict[str, Any]] = []

    print(f"============================================================")
    print(f"JAL DRISHTI NWDP Streamed Telemetry Downloader & Verifier")
    print(f"Target Directory: {OUTPUT_DIR}")
    print(f"Approved CSV Resources: {len(APPROVED_SOURCES)}")
    print(f"============================================================")

    for idx, (state, period, filename, url) in enumerate(APPROVED_SOURCES, 1):
        final_path = os.path.join(OUTPUT_DIR, filename)
        print(f"[{idx:02d}/18] Processing {state} ({period}) -> {filename}...")
        
        # Check if already present and valid
        if not force and os.path.exists(final_path) and os.path.getsize(final_path) > 1000:
            print(f"  [CACHE] File exists ({os.path.getsize(final_path):,} bytes). Validating schema...")
            # Verify existing file
            try:
                stats = validate_csv_file(final_path)
                sha = compute_sha256(final_path)
                print(f"  [OK] Cached file valid: {stats['rows']:,} rows, {stats['valid']:,} valid depths, {stats['min_date']} to {stats['max_date']}")
                manifest_entries.append({
                    'state': state,
                    'period': period,
                    'filename': filename,
                    'local_path': final_path.replace('\\', '/'),
                    'url': url,
                    'download_timestamp': datetime.now().isoformat(),
                    'byte_count': os.path.getsize(final_path),
                    'sha256': sha,
                    'header': stats['header'],
                    'row_count': stats['rows'],
                    'valid_depth_count': stats['valid'],
                    'quarantined_count': stats['quarantined'],
                    'min_timestamp': stats['min_date'],
                    'max_timestamp': stats['max_date'],
                    'validation_outcome': 'PASSED'
                })
                continue
            except Exception as e:
                print(f"  [WARN] Existing file validation failed ({e}), re-downloading...")

        # Perform streaming download to temporary file
        temp_fd, temp_path = tempfile.mkstemp(dir=OUTPUT_DIR, suffix='.tmp')
        os.close(temp_fd)

        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        sha_calc = hashlib.sha256()
        bytes_count = 0
        t0 = datetime.now()

        try:
            with urllib.request.urlopen(req, timeout=180) as resp, open(temp_path, 'wb') as f_out:
                if resp.status != 200:
                    raise RuntimeError(f"HTTP {resp.status} response from server")
                while True:
                    chunk = resp.read(1024 * 1024)
                    if not chunk:
                        break
                    f_out.write(chunk)
                    sha_calc.update(chunk)
                    bytes_count += len(chunk)

            # Validate downloaded CSV structure
            stats = validate_csv_file(temp_path)
            if stats['rows'] == 0:
                raise ValueError("Downloaded CSV contains 0 data rows")

            # Atomically replace destination
            if os.path.exists(final_path):
                os.remove(final_path)
            os.replace(temp_path, final_path)

            elapsed = (datetime.now() - t0).total_seconds()
            sha256_hex = sha_calc.hexdigest()
            print(f"  [SUCCESS] {bytes_count:,} bytes | {stats['rows']:,} rows | Valid: {stats['valid']:,} | Quarantined: {stats['quarantined']:,} | {stats['min_date']} to {stats['max_date']} ({elapsed:.1f}s)")

            manifest_entries.append({
                'state': state,
                'period': period,
                'filename': filename,
                'local_path': final_path.replace('\\', '/'),
                'url': url,
                'download_timestamp': datetime.now().isoformat(),
                'byte_count': bytes_count,
                'sha256': sha256_hex,
                'header': stats['header'],
                'row_count': stats['rows'],
                'valid_depth_count': stats['valid'],
                'quarantined_count': stats['quarantined'],
                'min_timestamp': stats['min_date'],
                'max_timestamp': stats['max_date'],
                'validation_outcome': 'PASSED'
            })
        except Exception as e:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            print(f"  [ERROR] Download/validation failed for {filename}: {e}")
            manifest_entries.append({
                'state': state,
                'period': period,
                'filename': filename,
                'local_path': final_path.replace('\\', '/'),
                'url': url,
                'download_timestamp': datetime.now().isoformat(),
                'validation_outcome': f"FAILED: {e}"
            })

    manifest_path = os.path.join(OUTPUT_DIR, 'nwdp_telemetry_download_manifest.json')
    with open(manifest_path, 'w', encoding='utf-8') as f_man:
        json.dump({
            'generated_at': datetime.now().isoformat(),
            'total_resources': len(manifest_entries),
            'passed_count': sum(1 for e in manifest_entries if e.get('validation_outcome') == 'PASSED'),
            'resources': manifest_entries
        }, f_man, indent=2)

    print(f"\nManifest successfully written to: {manifest_path}")

def compute_sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()

def validate_csv_file(path: str) -> Dict[str, Any]:
    row_count = 0
    valid_count = 0
    quarantined_count = 0
    min_date = '9999'
    max_date = '0000'

    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        reader = csv.reader(f)
        header = next(reader, None)
        if not header or len(header) < 5:
            raise ValueError(f"Invalid or missing CSV header: {header}")

        date_idx = -1
        depth_idx = -1
        for col_i, col in enumerate(header):
            cl = col.lower()
            if 'time' in cl or 'date' in cl or 'acquisition' in cl:
                date_idx = col_i
            if 'water' in cl or 'level' in cl or 'meter' in cl or 'depth' in cl:
                depth_idx = col_i

        for row in reader:
            if not row:
                continue
            row_count += 1
            if 0 <= date_idx < len(row):
                d_str = row[date_idx].strip()
                for fmt in ['%d-%m-%Y %H:%M:%S', '%d-%m-%Y %H:%M', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d', '%d-%m-%Y', '%d/%m/%Y']:
                    try:
                        dt = datetime.strptime(d_str[:19].strip(), fmt)
                        iso = dt.strftime('%Y-%m-%d')
                        if iso < min_date: min_date = iso
                        if iso > max_date: max_date = iso
                        break
                    except ValueError:
                        pass
            if 0 <= depth_idx < len(row):
                try:
                    v = float(row[depth_idx])
                    if 0.0 <= v <= 150.0:
                        valid_count += 1
                    else:
                        quarantined_count += 1
                except ValueError:
                    quarantined_count += 1

    return {
        'header': header,
        'rows': row_count,
        'valid': valid_count,
        'quarantined': quarantined_count,
        'min_date': min_date if min_date != '9999' else None,
        'max_date': max_date if max_date != '0000' else None,
    }

if __name__ == '__main__':
    download_and_verify_all(force=False)
