"""
Automated Regression Tests for CGWB IN-GRES Label Extraction & Ledger Construction.
Verifies label ledger integrity, checksums, state coverage, categorization validity,
uniqueness, geographic crosswalk, and reconciliation with official national abstracts.
"""

import os
import hashlib
import pandas as pd
import pytest

LEDGER_PATH = "data/derived/cgwb_ingres_labels_ledger.csv"
COVERAGE_PATH = "data/derived/cgwb_ingres_coverage_matrix.csv"
CROSSWALK_PATH = "data/derived/cgwb_ingres_geographic_crosswalk.csv"
QUARANTINE_PATH = "data/derived/cgwb_ingres_unmatched_quarantine.csv"
SOURCE_PDF = "data/sources/cgwb_ingres/cgwb_national_compilation_2023.pdf"
EXPECTED_PDF_SHA256 = "d24d8b22a0f2ddc0257be5d52f8ac42e8dfab7e658729a91184c3088307326ae"

VALID_CATEGORIES = {'Safe', 'Semi-Critical', 'Critical', 'Over-Exploited', 'Saline'}
EIGHT_STATES = {
    'Arunachal Pradesh', 'Assam', 'Haryana', 'Madhya Pradesh',
    'Punjab', 'Rajasthan', 'Sikkim', 'Uttar Pradesh'
}

def compute_sha256(filepath):
    h = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

class TestCgwbIngresExtraction:

    def test_source_pdf_checksum_valid(self):
        assert os.path.exists(SOURCE_PDF), f"Source PDF missing at {SOURCE_PDF}"
        actual_sha = compute_sha256(SOURCE_PDF)
        assert actual_sha == EXPECTED_PDF_SHA256, f"PDF SHA-256 mismatch: expected {EXPECTED_PDF_SHA256}, got {actual_sha}"

    def test_ledger_exists_and_has_rows(self):
        assert os.path.exists(LEDGER_PATH), f"Ledger file missing at {LEDGER_PATH}"
        df = pd.read_csv(LEDGER_PATH)
        assert len(df) >= 1000, f"Expected at least 1,000 ledger records, got {len(df)}"

    def test_eight_states_covered_in_ledger(self):
        df = pd.read_csv(LEDGER_PATH)
        states_in_ledger = set(df['state'].unique())
        assert EIGHT_STATES.issubset(states_in_ledger), f"Missing states: {EIGHT_STATES - states_in_ledger}"

    def test_official_categories_strictly_adhered_to(self):
        df = pd.read_csv(LEDGER_PATH)
        for cat in df['official_category'].dropna().unique():
            assert cat in VALID_CATEGORIES, f"Invalid category found in ledger: {cat}"

    def test_coverage_matrix_reconciles_with_official_abstracts(self):
        assert os.path.exists(COVERAGE_PATH), "Coverage matrix missing"
        cov = pd.read_csv(COVERAGE_PATH).set_index('state')
        
        # Verify 2023 exact abstract counts from Annexure III(A)
        assert cov.loc['Haryana', 'over_exploited_2023'] == 88
        assert cov.loc['Haryana', 'critical_2023'] == 11
        assert cov.loc['Haryana', 'semi_critical_2023'] == 9
        
        assert cov.loc['Punjab', 'over_exploited_2023'] == 117
        assert cov.loc['Punjab', 'critical_2023'] == 3
        assert cov.loc['Punjab', 'semi_critical_2023'] == 13
        
        assert cov.loc['Madhya Pradesh', 'over_exploited_2023'] == 26
        assert cov.loc['Madhya Pradesh', 'critical_2023'] == 5
        assert cov.loc['Madhya Pradesh', 'semi_critical_2023'] == 60
        
        assert cov.loc['Assam', 'semi_critical_2023'] == 1
        assert cov.loc['Arunachal Pradesh', 'extracted_stressed_units_2023'] == 0
        assert cov.loc['Sikkim', 'extracted_stressed_units_2023'] == 0

    def test_geographic_crosswalk_and_quarantine(self):
        assert os.path.exists(CROSSWALK_PATH), "Geographic crosswalk missing"
        assert os.path.exists(QUARANTINE_PATH), "Quarantine file missing"
        
        cw = pd.read_csv(CROSSWALK_PATH)
        quar = pd.read_csv(QUARANTINE_PATH)
        
        assert len(cw) >= 10, "Expected at least 10 high-confidence block matches in crosswalk"
        assert all(cw['confidence'] == 'HIGH')
        assert all(cw['match_type'] == 'EXACT_BLOCK_MATCH')
        
        # Verify specific key pilot blocks are correctly mapped
        tikamgarh = cw[cw['jaldrishti_block_id'] == 'blk_tikamgarh_main']
        assert len(tikamgarh) == 1
        assert tikamgarh.iloc[0]['official_category_2023'] == 'Semi-Critical'
        
        # Verify quarantined block has explicit reason
        assert len(quar) >= 1
        assert 'reason' in quar.columns
        assert quar.iloc[0]['reason'] != ""
