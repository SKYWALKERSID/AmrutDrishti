import pymupdf
import re

doc = pymupdf.open('data/sources/cgwb_ingres/cgwb_national_compilation_2023.pdf')

def parse_annexure_iv_page(page_num, state_name):
    page = doc[page_num - 1]
    tables = page.find_tables()
    print(f"\n[Page {page_num} - {state_name}] Tables found: {len(tables.tables)}")
    records = []
    if tables.tables:
        t = tables.tables[0]
        df = t.extract()
        print(f"Header: {df[0] if len(df) > 0 else 'None'}")
        print(f"Rows: {len(df)}")
        for row in df[1:6]:
            print("  Row:", row)
    else:
        # Fallback to text parsing
        text = page.get_text()
        print(f"Text lines: {len(text.splitlines())}")

# Test on Assam (345), Haryana (350), MP (356), Punjab (360), UP (370)
for p, s in [(345, 'Assam'), (350, 'Haryana'), (356, 'Madhya Pradesh'), (360, 'Punjab'), (370, 'Uttar Pradesh')]:
    parse_annexure_iv_page(p, s)
