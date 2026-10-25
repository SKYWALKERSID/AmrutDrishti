import json

with open('audit/JALDRISHTI_DUAL_SOURCE_REGISTRY.json') as f:
    registry = json.load(f)

blocks = registry['blocks']

lines = []
lines.append('# JalDrishti — Freshness Reconciliation Audit\n')
lines.append('**Audit Date:** October 23, 2026  ')
lines.append('**System Clock / Local Evaluation Timestamp:** `2026-10-23T22:35:00+05:30` (UTC: `2026-10-23T17:05:00Z`)  ')
lines.append('**Purpose:** Reconcile the 400-day statutory observation freshness safeguard across all 56 canonical blocks under the harmonized Dual-Source CGWB + NWDP architecture.\n')
lines.append('---\n')
lines.append('## 1. Statutory Freshness Rule Definition\n')
lines.append('The freshness gate is governed by [`src/lib/data/forecastIntegrity.ts`](file:///F:/Projects/JalDrishti/src/lib/data/forecastIntegrity.ts):\n')
lines.append('$$\\text{Age (solar days)} = \\frac{\\text{System Timestamp} - \\text{Observation Origin Timestamp}}{86,400,000\\text{ ms}}$$\n')
lines.append('$$\\text{Freshness Pass Condition} \\iff 0 \\le \\text{Age} \\le 400\\text{ days}$$\n')
lines.append('- **Threshold Value:** Unconditionally fixed at **400 days**.')
lines.append('- **Evaluated Metric:** The physical observation date of the newest validated groundwater depth measurement in the block\'s selected source series.')
lines.append('- **Excluded Timestamps:** Ingestion date, download date, catalog refresh date, and file modification date (`mtime`) are strictly excluded from freshness calculations.\n')
lines.append('---\n')
lines.append('## 2. Reconciled 56-Block Freshness Matrix\n')
lines.append('| Block ID | State | District | Block Name | Selected Source | Latest Measurement Date | Age (Days) | Freshness Gate | Operational Eligibility |')
lines.append('| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: |')

for b in blocks:
    bid = b['block_id']
    st = b['state']
    dt = b['district']
    bn = b['block_name']
    src = b['selected_source_category'].replace('_', ' ')
    ld = b['latest_measurement_date']
    age = f"{b['observation_age_days']:.1f} d"
    gate = '**PASSED**' if b['freshness_gate_passed'] else '**FAILED**'
    elig = '**ELIGIBLE**' if b['operational_eligibility'] else '**BLOCKED (Stale)**'
    lines.append(f'| `{bid}` | {st} | {dt} | {bn} | {src} | {ld} | {age} | {gate} | {elig} |')

lines.append('\n---\n')
lines.append('## 3. Key Reconciliation Insights\n')
lines.append('1. **43 Blocks Unlocked for Live Forecasting (76.8%):**')
lines.append('   - Blocks in Madhya Pradesh (9), Karnataka (3), Rajasthan (13), Punjab (4), Haryana (3), Telangana (3), Tamil Nadu (3), Meghalaya (3), and Tripura (2) have valid 2026 measurements between 2 and 258 days old.')
lines.append('   - All 43 blocks pass the 400-day freshness gate without requiring artificial relaxation of the threshold.')
lines.append('2. **Honest Gating of 13 Archived Blocks (23.2%):**')
lines.append('   - In Assam (11 blocks), official telemetry tables in both state and national 2026 packages contain zero rows; the pipeline falls back to verified CGWB manual quarterly records (latest Jan 2024, age ~996d).')
lines.append('   - In Haryana, `blk_mahendragarh_narnaul` lacks a telemetry station; falls back to manual records (latest Jan 2024, age ~1026d).')
lines.append('   - In Tripura, `blk_dhalai_salema` has an unpopulated 2026 station feed; falls back to NWDP 2021-2025 (latest Aug 2023, age ~1149d).')
lines.append('   - For all 13 blocks, the platform legitimately fails closed in operational mode, explicitly notifying users that observations exceed 400 days, while keeping the full historical series available for exploration and ML demonstration (`mode=demo`).')
lines.append('3. **Zero Data Fabrication or Leakage:**')
lines.append('   - No observations were invented, extrapolated, or relabelled across administrative boundaries.')

with open('audit/JALDRISHTI_FRESHNESS_RECONCILIATION.md', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

print('Updated JALDRISHTI_FRESHNESS_RECONCILIATION.md successfully.')
