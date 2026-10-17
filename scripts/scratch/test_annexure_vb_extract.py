import pymupdf
import pandas as pd
import re

doc = pymupdf.open('data/sources/cgwb_ingres/cgwb_national_compilation_2023.pdf')

def clean_name(n):
    if not n or pd.isna(n):
        return ""
    n = str(n).replace('\n', ' ').strip()
    n = re.sub(r'^[_]+', '', n).strip()
    return re.sub(r'\s+', ' ', n)

def parse_annexure_v_b(doc):
    records = []
    target_states = ['ARUNACHAL PRADESH', 'ASSAM', 'HARYANA', 'MADHYA PRADESH', 'PUNJAB', 'RAJASTHAN', 'SIKKIM', 'UTTAR PRADESH']
    curr_state = ""
    
    for p_num in range(419, 452):
        page = doc[p_num - 1]
        tables = page.find_tables()
        if not tables.tables:
            continue
        data = tables.tables[0].extract()
        for row in data:
            if not row or len(row) < 9:
                continue
            r_str = " ".join([clean_name(c) for c in row if c])
            # Check state header
            c0 = clean_name(row[0]).upper()
            for ts in target_states:
                if ts in c0 or (len(r_str) < 30 and ts in r_str.upper()):
                    curr_state = ts.title()
                    break
            
            # Row header check
            if 'Name of Assessment' in r_str or 'Categorization 2022' in r_str or 'Deteriorated' in r_str or 'Improved' in r_str:
                continue
            if 'COMPARISON OF' in r_str.upper():
                continue
                
            c_dist = clean_name(row[1])
            c_block = clean_name(row[2])
            soe_2022 = clean_name(row[3])
            cat_2022 = clean_name(row[4])
            soe_2023 = clean_name(row[7])
            cat_2023 = clean_name(row[8])
            remark = clean_name(row[9]) if len(row) > 9 else ""
            
            if curr_state and c_block and cat_2022 and cat_2023 and 'Assessment' not in c_block:
                records.append({
                    'state': curr_state,
                    'district': c_dist,
                    'assessment_unit': c_block,
                    'soe_2022': soe_2022,
                    'cat_2022': cat_2022,
                    'soe_2023': soe_2023,
                    'cat_2023': cat_2023,
                    'remark': remark,
                    'page': p_num
                })
                
    return pd.DataFrame(records)

df_vb = parse_annexure_v_b(doc)
print(f"Total 2022-2023 comparison records extracted: {len(df_vb)}")
if len(df_vb) > 0:
    print(df_vb.groupby(['state', 'cat_2022']).size())
    print("\nSample records:")
    print(df_vb.head(10)[['state', 'district', 'assessment_unit', 'soe_2022', 'cat_2022', 'soe_2023', 'cat_2023', 'remark']])
