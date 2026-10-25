import json
from collections import defaultdict

with open('audit/canonical_43_blocks_active.json') as f:
    blocks43 = json.load(f)

with open('data/derived/verified_cgwb_block_series.json') as f:
    cgwb = json.load(f)

with open('data/derived/nwdp_block_telemetry_series.json') as f:
    nwdp = json.load(f)

with open('src/lib/data/contrastHistoricalSeries.json') as f:
    contrast = json.load(f)

with open('audit/global_model_block_readiness.json') as f:
    readiness = json.load(f)

blocks_readiness = {b['block_id']: b for b in readiness.get('blocks', [])}

out_lines = []
out_lines.append("# Record-Level Observation Comparison: 43 Canonical Blocks\n")
out_lines.append("| Block ID | State | District | CGWB Obs (Dates) | NWDP Obs (Dates) | Contrast Obs (Dates) | Readiness Recorded Date |")
out_lines.append("|---|---|---|---|---|---|---|")

for b in blocks43:
    bid = b['id']
    st = b['state']
    dt = b['district']
    
    c = cgwb.get(bid, {})
    n = nwdp.get(bid, {})
    cont = contrast.get(bid, [])
    r = blocks_readiness.get(bid, {})

    c_obs = c.get('observations', [])
    c_first = c_obs[0]['observationDate'] if c_obs else 'None'
    c_last = c_obs[-1]['observationDate'] if c_obs else 'None'
    c_cnt = len(c_obs)
    c_str = f"{c_cnt} ({c_first}..{c_last})"

    n_obs = n.get('observations', [])
    n_first = n_obs[0]['observationDate'] if n_obs else 'None'
    n_last = n_obs[-1]['observationDate'] if n_obs else 'None'
    n_cnt = len(n_obs)
    n_str = f"{n_cnt} ({n_first}..{n_last})"

    cont_first = cont[0]['month'] if cont else 'None'
    cont_last = cont[-1]['month'] if cont else 'None'
    cont_cnt = len(cont)
    cont_str = f"{cont_cnt} ({cont_first}..{cont_last})"

    r_last = r.get('latest_verified_observation_date', 'None')
    r_str = f"{r_last}"

    out_lines.append(f"| `{bid}` | {st} | {dt} | {c_str} | {n_str} | {cont_str} | {r_str} |")

with open('audit/canonical_43_record_comparison.md', 'w', encoding='utf-8') as f:
    f.write("\n".join(out_lines))

print(f"Generated comparison for {len(blocks43)} blocks in audit/canonical_43_record_comparison.md")
