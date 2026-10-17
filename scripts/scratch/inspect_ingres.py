import urllib.request
import ssl
import re

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

req = urllib.request.Request('https://ingres.iith.ac.in/', headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
try:
    with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
        html = resp.read().decode('utf-8', errors='ignore')
        print('HTML length:', len(html))
        scripts = re.findall(r'src=["\'](.*?)["\']', html)
        print('Scripts:', scripts)
        for s in scripts:
            if 'main' in s:
                js_url = f'https://ingres.iith.ac.in/{s}'
                print('Fetching main JS:', js_url)
                req_js = urllib.request.Request(js_url, headers={'User-Agent': 'Mozilla/5.0'})
                js_text = urllib.request.urlopen(req_js, context=ctx).read().decode('utf-8', errors='ignore')
                print('Main JS length:', len(js_text))
                apis = re.findall(r'https?://[^\s"\'<>)]+|/api/[^\s"\'<>)]+', js_text)
                print('Found URLs in JS:', len(apis))
                for a in set(apis):
                    if any(k in a.lower() for k in ['api', 'gec', 'report', 'block', 'state', 'resource']):
                        print('   API endpoint:', a)

except Exception as e:
    print('Failed:', e)
