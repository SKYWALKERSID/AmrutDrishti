import urllib.request
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

urls = [
    ("CGWB Assessment 2023 PDF", "https://cdnbbsr.s3waas.gov.in/s3a70dc40477bc2adceef4d2c90f47eb82/uploads/2023/12/20231206209724415.pdf"),
    ("CGWB Main Assessment Page", "https://cgwb.gov.in/index.php/en/ground-water-resource-assessment-0"),
    ("Sikkim Springs Portal", "http://www.sikkimsprings.org/")
]

for name, url in urls:
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        with urllib.request.urlopen(req, context=ctx, timeout=15) as response:
            cl = response.headers.get("Content-Length")
            ct = response.headers.get("Content-Type")
            print(f"{name}: Status {response.status}, Content-Length: {cl}, Content-Type: {ct}")
    except Exception as e:
        print(f"{name}: Failed with {e}")
