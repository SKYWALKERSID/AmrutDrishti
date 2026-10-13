import glob
import json
import re
import pandas as pd
from datetime import datetime

# Build JSON of real observations by block
files = glob.glob('data/sources/cgwb_contrast/*.csv')
dfs = [pd.read_csv(f) for f in files]
df = pd.concat(dfs, ignore_errors=True)

def parse_date(d_str):
    if not isinstance(d_str, str):
        return None
    s = d_str.split(' ')[0]
    for fmt in ('%d-%m-%Y', '%Y-%m-%d', '%m/%d/%Y'):
        try:
            return datetime.strptime(s, fmt).strftime('%Y-%m-%d')
        except:
            pass
    return None

df['clean_date'] = df['Data Acquisition Time'].apply(parse_date)
df['clean_block'] = df['Block'].astype(str).str.strip().str.upper()
df['clean_dist'] = df['District'].astype(str).str.strip().str.upper()

# Load all 60 blocks from ts files
with open('src/lib/data/bundelkhand.ts', 'r', encoding='utf-8') as f:
    bk = f.read()
with open('src/lib/data/nationalContrast.ts', 'r', encoding='utf-8') as f:
    nc = f.read()

pattern = re.compile(r"id:\s*['\"](blk_[a-zA-Z0-9_]+)['\"],[\s\S]*?name:\s*['\"]([^'\"]+)['\"],[\s\S]*?districtName:\s*['\"]([^'\"]+)['\"]")
blocks = []
for m in pattern.finditer(bk + nc):
    blocks.append({
        'id': m.group(1),
        'name': m.group(2).strip().upper(),
        'districtName': m.group(3).strip().upper()
    })

print(f"Total blocks parsed: {len(blocks)}")
matched = {}
for b in blocks:
    sub = df[df['clean_block'] == b['name']]
    if len(sub) == 0:
        sub = df[df['clean_dist'] == b['districtName']]
    if len(sub) > 0:
        grp = sub.groupby('clean_date')['Groundwater Level Quarterly Manual (meter)'].mean().dropna()
        if len(grp) > 0:
            pts = [{'month': d, 'wellDepth': round(float(v), 2)} for d, v in grp.sort_index().items()][-16:]
            if len(pts) >= 2:
                matched[b['id']] = pts

print(f"Matched blocks with 2+ real quarters: {len(matched)}")
with open('src/lib/data/contrastHistoricalSeries.json', 'w') as out:
    json.dump(matched, out, indent=2)
print("Wrote contrastHistoricalSeries.json successfully")
