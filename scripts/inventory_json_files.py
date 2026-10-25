import os
import json
from pathlib import Path

root = Path('.')
json_files = []
for p in root.rglob('*.json'):
    parts = p.parts
    if any(x in parts for x in ['.next', 'node_modules', '.git', '.gemini']):
        continue
    rel = str(p.relative_to(root)).replace('\\', '/')
    json_files.append({
        'path': rel,
        'size_bytes': p.stat().st_size
    })

print(f'Total JSON files found: {len(json_files)}')
with open('audit/all_repo_json_inventory.json', 'w', encoding='utf-8') as f:
    json.dump(json_files, f, indent=2)

for f in sorted(json_files, key=lambda x: x['path']):
    print(f"{f['path']} ({f['size_bytes']} bytes)")
