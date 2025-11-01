#!/usr/bin/env python3
"""
Search trains for routes using only matched stations (from comprehensive mappings)
This ensures we only search routes where both origin and destination have valid API station codes
"""

import json
import urllib.request
from datetime import datetime
import time

API_BASE_URL = "https://isapi.pakrailways.gov.pk/v1/ticket"
TRAVEL_DATE = "2025-11-01"  # November 1, 2025

def load_routes_with_matched_stations():
    """Load routes that have both origin and destination matched"""
    with open('routes-with-matched-stations.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    return data.get('routes', [])

def search_route(origin_code: str, dest_code: str, origin_name: str, dest_name: str):
    """Search trains for a single route using station codes"""
    try:
        time.sleep(0.05)  # Minimal delay
        
        url = f"{API_BASE_URL}/trainInfo/trainInfoList"
        payload = {
            "boardStationCode": origin_code,
            "arrivalStationCode": dest_code,
            "travelDate": TRAVEL_DATE
        }
        
        payload_bytes = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(url, data=payload_bytes, method='POST')
        req.add_header('Content-Type', 'application/json')
        
        with urllib.request.urlopen(req, timeout=15) as response:
            data = json.loads(response.read().decode('utf-8'))
        
        if data.get('code') == 200:
            trains = []
            for train in data.get('data', []):
                train_dir_day = train.get('trainDirDay', {})
                trains.append({
                    "trainDirDayId": train_dir_day.get('id'),
                    "trainCode": train_dir_day.get('trainCode'),
                    "trainId": train_dir_day.get('trainId'),
                    "startTrainDate": train_dir_day.get('startTrainDate')
                })
            return trains, None
        else:
            return None, f"API returned code: {data.get('code')}"
    
    except Exception as e:
        return None, str(e)

def main():
    """Main execution"""
    print("\n" + "=" * 80)
    print("SEARCHING ROUTES WITH MATCHED STATIONS ONLY")
    print("=" * 80)
    print(f"Travel Date: {TRAVEL_DATE}")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Load routes with matched stations
    routes = load_routes_with_matched_stations()
    print(f"✅ Loaded {len(routes)} routes (all have matched origin and destination stations)")
    
    # Remove duplicates (keep unique origin->dest+direction)
    unique_routes = {}
    for route in routes:
        route_key = (route['origin'], route['destination'], route['direction'])
        if route_key not in unique_routes:
            unique_routes[route_key] = route
    
    unique_routes_list = list(unique_routes.values())
    print(f"✅ {len(unique_routes_list)} unique routes to search")
    print(f"Estimated time: ~{len(unique_routes_list) * 0.1 / 60:.1f} minutes")
    print()
    
    # Search each route
    results = []
    successful = 0
    failed = 0
    
    for idx, route in enumerate(unique_routes_list, 1):
        origin = route['origin']
        dest = route['destination']
        origin_code = route['originStationCode']
        dest_code = route['destinationStationCode']
        direction = route['direction']
        
        print(f"[{idx}/{len(unique_routes_list)}] {origin[:30]:30s} -> {dest[:30]:30s} ({direction})", end=" ... ")
        
        trains, error = search_route(origin_code, dest_code, origin, dest)
        
        if error:
            print(f"❌ {error}")
            failed += 1
            results.append({
                **route,
                'error': error,
                'trainCount': 0,
                'trains': []
            })
        else:
            train_count = len(trains)
            print(f"✅ {train_count} trains found")
            successful += 1
            results.append({
                **route,
                'trainCount': train_count,
                'trains': trains
            })
        
        # Save progress every 20 routes
        if idx % 20 == 0:
            output_file = f"route-searches-matched-{TRAVEL_DATE.replace('-', '')}-partial.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'travelDate': TRAVEL_DATE,
                    'processed': idx,
                    'total': len(unique_routes_list),
                    'successful': successful,
                    'failed': failed,
                    'results': results
                }, f, indent=2, ensure_ascii=False)
            print(f"💾 Progress saved ({idx}/{len(unique_routes_list)} routes processed)")
    
    # Save final results
    print("\n" + "=" * 80)
    print("SAVING FINAL RESULTS")
    print("=" * 80)
    
    output_file = f"route-searches-matched-{TRAVEL_DATE.replace('-', '')}.json"
    final_output = {
        'travelDate': TRAVEL_DATE,
        'completedAt': datetime.now().isoformat(),
        'totalRoutes': len(unique_routes_list),
        'successfulSearches': successful,
        'failedSearches': failed,
        'totalTrainsFound': sum(r.get('trainCount', 0) for r in results),
        'results': results
    }
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(final_output, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Saved final results to {output_file}")
    
    # Summary
    total_trains = sum(r.get('trainCount', 0) for r in results)
    print(f"\n📊 Summary:")
    print(f"  - Routes searched: {len(unique_routes_list)}")
    print(f"  - Successful: {successful}")
    print(f"  - Failed: {failed}")
    print(f"  - Total trains found: {total_trains}")
    print(f"  - Average trains per route: {total_trains / successful if successful > 0 else 0:.1f}")

if __name__ == "__main__":
    main()

