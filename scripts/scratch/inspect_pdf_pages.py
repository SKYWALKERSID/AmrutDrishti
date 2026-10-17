import fitz  # PyMuPDF

doc = fitz.open('data/sources/cgwb_ingres/cgwb_national_compilation_2023.pdf')
print("Total pages:", len(doc))

states = ['PUNJAB', 'HARYANA', 'RAJASTHAN', 'MADHYA PRADESH', 'ASSAM', 'ARUNACHAL PRADESH', 'UTTAR PRADESH', 'SIKKIM']
state_pages = {s: [] for s in states}
annexure_pages = []

for i, page in enumerate(doc):
    t = page.get_text()
    t_up = t.upper()
    if 'ANNEXURE' in t_up:
        annexure_pages.append((i+1, t[:150].replace('\n', ' ')))
    for s in states:
        if s in t_up:
            state_pages[s].append(i+1)

print(f"\nTotal Annexure pages mentioned: {len(annexure_pages)}")
for p, snippet in annexure_pages[:15]:
    print(f"P.{p}: {snippet}")

print("\nState occurrences across pages:")
for s, p_list in state_pages.items():
    print(f"{s}: {len(p_list)} pages. First 10: {p_list[:10]}")
