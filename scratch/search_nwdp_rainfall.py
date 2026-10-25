import urllib.request
import json

url = 'https://nwdp.nwic.gov.in/api/3/action/package_search?q=rainfall&rows=100'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, timeout=15) as response:
        data = json.loads(response.read().decode())
        results = data.get('result', {}).get('results', [])
        print(f'Retrieved {len(results)} packages')
        target_states = ['Haryana', 'Karnataka', 'Madhya Pradesh', 'Meghalaya', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Tripura']
        matched = []
        for pkg in results:
            title = pkg.get('title', '')
            name = pkg.get('name', '')
            org = pkg.get('organization', {}).get('title', '')
            for s in target_states:
                if s.lower() in title.lower() or s.lower() in name.lower() or s.lower() in org.lower():
                    resources = pkg.get('resources', [])
                    matched.append({
                        'state': s,
                        'title': title,
                        'name': name,
                        'org': org,
                        'resource_count': len(resources),
                        'resources': [{'name': r.get('name'), 'url': r.get('url'), 'format': r.get('format')} for r in resources]
                    })
        print(f'Matched {len(matched)} packages for target states:')
        for m in matched:
            print(f"State: {m['state']} | Title: {m['title']} | Org: {m['org']}")
            for res in m['resources']:
                print(f"   - {res['name']} | URL: {res['url']}")
except Exception as e:
    print('Error:', e)
