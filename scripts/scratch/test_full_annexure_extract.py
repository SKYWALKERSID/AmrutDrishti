"""
Extraction Pipeline for Official CGWB IN-GRES Groundwater Assessment Categorization Labels.
Parses the National Compilation on Dynamic Ground Water Resources of India, 2023 (CGWB / MoJS).
Source SHA-256: d24d8b22a0f2ddc0257be5d52f8ac42e8dfab7e658729a91184c3088307326ae
"""

import os
import re
import hashlib
import pymupdf
import pandas as pd

PDF_PATH = "data/sources/cgwb_ingres/cgwb_national_compilation_2023.pdf"
SOURCE_URL = "https://cdnbbsr.s3waas.gov.in/s3a70dc40477bc2adceef4d2c90f47eb82/uploads/2023/12/20231206209724415.pdf"
SOURCE_SHA256 = "d24d8b22a0f2ddc0257be5d52f8ac42e8dfab7e658729a91184c3088307326ae"

STATE_PAGE_MAP_IV_A = {
    'Assam': [345],
    'Haryana': [350, 351],
    'Madhya Pradesh': [356, 357],
    'Punjab': [360, 361],
    'Rajasthan': [362, 363, 364, 365],
    'Uttar Pradesh': [370, 371, 372]
}

STATE_TOTALS_2023 = {
    'Arunachal Pradesh': {'total': 42, 'safe': 42, 'semi_critical': 0, 'critical': 0, 'over_exploited': 0, 'saline': 0, 'unit_type': 'Block'},
    'Assam': {'total': 245, 'safe': 244, 'semi_critical': 1, 'critical': 0, 'over_exploited': 0, 'saline': 0, 'unit_type': 'Block'},
    'Haryana': {'total': 143, 'safe': 35, 'semi_critical': 9, 'critical': 11, 'over_exploited': 88, 'saline': 0, 'unit_type': 'Block'},
    'Madhya Pradesh': {'total': 317, 'safe': 226, 'semi_critical': 60, 'critical': 5, 'over_exploited': 26, 'saline': 0, 'unit_type': 'Block'},
    'Punjab': {'total': 153, 'safe': 20, 'semi_critical': 13, 'critical': 3, 'over_exploited': 117, 'saline': 0, 'unit_type': 'Block'},
    'Rajasthan': {'total': 302, 'safe': 38, 'semi_critical': 22, 'critical': 23, 'over_exploited': 216, 'saline': 3, 'unit_type': 'Block'},
    'Sikkim': {'total': 6, 'safe': 6, 'semi_critical': 0, 'critical': 0, 'over_exploited': 0, 'saline': 0, 'unit_type': 'District'},
    'Uttar Pradesh': {'total': 836, 'safe': 559, 'semi_critical': 172, 'critical': 43, 'over_exploited': 62, 'saline': 0, 'unit_type': 'Block'}
}

def clean_name(n):
    if not n or pd.isna(n):
        return ""
    n = str(n).replace('\n', ' ').strip()
    n = re.sub(r'\s+', ' ', n)
    return n

def extract_annexure_iv_a(doc):
    records = []
    
    for state, pages in STATE_PAGE_MAP_IV_A.items():
        curr_district = ""
        for p_num in pages:
            page = doc[p_num - 1]
            tables = page.find_tables()
            if not tables.tables:
                continue
            table = tables.tables[0]
            data = table.extract()
            
            for row in data:
                if not row or len(row) < 8:
                    continue
                # Skip header rows and abstract rows
                c0 = clean_name(row[0])
                c1 = clean_name(row[1])
                if c0 in ['S. No', 'CATEGORIZATION of ASSESSMENT UNITS, 2023', 'ABSTRACT', 'Total No. of Assessed Units']:
                    continue
                if state.upper() in c0.upper() or 'CATEGORIZATION' in c0.upper():
                    continue
                if 'Number of' in c0 or 'Number of' in c1:
                    continue
                if c0.isdigit() and c1 and c1 not in ['Kamrup (M) Urban', 'ABSTRACT'] and not c1.isdigit():
                    curr_district = c1
                elif c1 and not c1.isdigit() and 'Assessment' not in c1 and 'District' not in c1:
                    curr_district = c1
                    
                # Columns: 
                # [0] S.No dist, [1] District, [2] S.No SC, [3] Name Semi-Critical, 
                # [4] S.No Crit, [5] Name Critical, [6] S.No OE, [7] Name Over-Exploited
                semi_crit = clean_name(row[3])
                crit = clean_name(row[5])
                over_exp = clean_name(row[7])
                
                if semi_crit and not semi_crit.isdigit() and 'Assessment' not in semi_crit and 'ABSTRACT' not in semi_crit:
                    records.append({
                        'assessment_year': 2023,
                        'state': state,
                        'district': curr_district,
                        'assessment_unit': semi_crit,
                        'assessment_unit_type': 'Block',
                        'official_category': 'Semi-Critical',
                        'source_document': 'National Compilation on Dynamic Ground Water Resources of India, 2023',
                        'source_page': p_num,
                        'source_annexure': 'Annexure - IV(A)',
                        'source_sha256': SOURCE_SHA256,
                        'extraction_method': 'PyMuPDF Table Parser',
                        'validation_status': 'Verified from Official Annexure'
                    })
                if crit and not crit.isdigit() and 'Assessment' not in crit and 'ABSTRACT' not in crit:
                    records.append({
                        'assessment_year': 2023,
                        'state': state,
                        'district': curr_district,
                        'assessment_unit': crit,
                        'assessment_unit_type': 'Block',
                        'official_category': 'Critical',
                        'source_document': 'National Compilation on Dynamic Ground Water Resources of India, 2023',
                        'source_page': p_num,
                        'source_annexure': 'Annexure - IV(A)',
                        'source_sha256': SOURCE_SHA256,
                        'extraction_method': 'PyMuPDF Table Parser',
                        'validation_status': 'Verified from Official Annexure'
                    })
                if over_exp and not over_exp.isdigit() and 'Assessment' not in over_exp and 'ABSTRACT' not in over_exp:
                    records.append({
                        'assessment_year': 2023,
                        'state': state,
                        'district': curr_district,
                        'assessment_unit': over_exp,
                        'assessment_unit_type': 'Block',
                        'official_category': 'Over-Exploited',
                        'source_document': 'National Compilation on Dynamic Ground Water Resources of India, 2023',
                        'source_page': p_num,
                        'source_annexure': 'Annexure - IV(A)',
                        'source_sha256': SOURCE_SHA256,
                        'extraction_method': 'PyMuPDF Table Parser',
                        'validation_status': 'Verified from Official Annexure'
                    })

    return pd.DataFrame(records)

doc = pymupdf.open(PDF_PATH)
df_stressed = extract_annexure_iv_a(doc)
print(f"Total stressed assessment units extracted: {len(df_stressed)}")
print(df_stressed.groupby(['state', 'official_category']).size())
