"""Discover official NWDP/NWIC dataset metadata and resource endpoints for all 10 states."""
import json
import ssl
import sys
import urllib.request
import urllib.error

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

DATASETS = {
    'Karnataka': {
        'catalogue_url': 'https://nwdp.nwic.gov.in/dataset/ground-water-level-telemetry-hourly-karnataka-ground-water-department',
        'slug': 'ground-water-level-telemetry-hourly-karnataka-ground-water-department'
    },
    'Telangana': {
        'catalogue_url': 'https://nwdp.nwic.gov.in/dataset/ground-water-level-telemetry-daily-telangana-gw',
        'slug': 'ground-water-level-telemetry-daily-telangana-gw'
    },
    'Tamil Nadu': {
        'catalogue_url': 'https://nwdp.nwic.gov.in/dataset/ground-water-level-telemetry-daily-tamil-nadu-sw-gw',
        'slug': 'ground-water-level-telemetry-daily-tamil-nadu-sw-gw'
    },
    'Madhya Pradesh': {
        'catalogue_url': 'https://nwdp.nwic.gov.in/dataset/ground-water-level-telemetry-daily-madhya-pradesh-gw',
        'slug': 'ground-water-level-telemetry-daily-madhya-pradesh-gw'
    },
    'Rajasthan': {
        'catalogue_url': 'https://nwdp.nwic.gov.in/dataset/ground-water-level-telemetry-hourly-rajasthan-ground-water-department',
        'slug': 'ground-water-level-telemetry-hourly-rajasthan-ground-water-department'
    },
    'Punjab': {
        'catalogue_url': 'https://nwdp.nwic.gov.in/dataset/ground-water-level-telemetry-hourly-punjab-ground-water-department',
        'slug': 'ground-water-level-telemetry-hourly-punjab-ground-water-department'
    },
    'Haryana': {
        'catalogue_url': 'https://nwdp.nwic.gov.in/dataset/ground-water-level-telemetry-daily-haryana-gw',
        'slug': 'ground-water-level-telemetry-daily-haryana-gw'
    },
    'Meghalaya': {
        'catalogue_url': 'https://nwdp.nwic.gov.in/dataset/ground-water-level-telemetry-daily-meghalaya',
        'slug': 'ground-water-level-telemetry-daily-meghalaya'
    },
    'Assam': {
        'catalogue_url': 'https://nwdp.nwic.gov.in/dataset/ground-water-level-telemetry-daily-assam',
        'slug': 'ground-water-level-telemetry-daily-assam'
    },
    'Tripura': {
        'catalogue_url': 'https://nwdp.nwic.gov.in/dataset/ground-water-level-telemetry-daily-tripura',
        'slug': 'ground-water-level-telemetry-daily-tripura'
    }
}

def discover_all():
    base_url = 'https://nwdp.nwic.gov.in/api/3/action/package_show?id='
    registry = {}

    for state, info in DATASETS.items():
        slug = info['slug']
        url = base_url + slug
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        print(f"Querying [{state}] -> {slug} ...")
        try:
            with urllib.request.urlopen(req, timeout=20, context=ctx) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                pkg = data.get('result', {})
                resources = pkg.get('resources', [])
                print(f"  Title: {pkg.get('title')}")
                print(f"  Package ID: {pkg.get('id')}")
                print(f"  Total resources: {len(resources)}")
                
                res_list = []
                for r in resources:
                    res_info = {
                        'id': r.get('id'),
                        'name': r.get('name'),
                        'description': r.get('description'),
                        'format': r.get('format'),
                        'url': r.get('url'),
                        'created': r.get('created'),
                        'last_modified': r.get('last_modified'),
                    }
                    print(f"    - [{res_info['format']}] {res_info['name']}: {res_info['url']}")
                    res_list.append(res_info)

                registry[state] = {
                    'state': state,
                    'catalogue_url': info['catalogue_url'],
                    'slug': slug,
                    'package_id': pkg.get('id'),
                    'title': pkg.get('title'),
                    'notes': pkg.get('notes'),
                    'organization': pkg.get('organization', {}).get('title') if pkg.get('organization') else None,
                    'metadata_created': pkg.get('metadata_created'),
                    'metadata_modified': pkg.get('metadata_modified'),
                    'resources': res_list,
                    'status': 'discovered' if len(resources) > 0 else 'no_resources'
                }
        except urllib.error.HTTPError as e:
            print(f"  HTTP Error {e.code}: {e.reason}")
            registry[state] = {
                'state': state,
                'catalogue_url': info['catalogue_url'],
                'slug': slug,
                'error': f"HTTP {e.code}: {e.reason}",
                'status': 'http_error'
            }
        except Exception as e:
            print(f"  Error: {e}")
            registry[state] = {
                'state': state,
                'catalogue_url': info['catalogue_url'],
                'slug': slug,
                'error': str(e),
                'status': 'connection_error'
            }

    with open('data/sources/nwdp_telemetry_registry.json', 'w', encoding='utf-8') as f:
        json.dump(registry, f, indent=2)
    print("\nSaved discovery registry to data/sources/nwdp_telemetry_registry.json")

if __name__ == '__main__':
    discover_all()
