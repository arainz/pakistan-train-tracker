#!/usr/bin/env python3
"""
Fetch distance data for each route from Pak Railways API
Uses trainDirDayId from route searches to get stop timetables with distances
"""

import json
import urllib.request
from datetime import datetime
import time
from collections import defaultdict

API_BASE_URL = "https://isapi.pakrailways.gov.pk/v1/ticket"
TRAVEL_DATE = "2025-11-01"

def load_route_searches():
    """Load route search results"""
    with open('route-searches-matched-20251101.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data.get('results', [])

def fetch_stop_timetable(train_dir_day_id):
    """Fetch stop timetable for a train using trainDirDayId"""
    url = f"{API_BASE_URL}/trainInfo/stopTimeTable/{train_dir_day_id}"
    
    try:
        time.sleep(0.05)  # Minimal delay
        
        req = urllib.request.Request(url)
        req.add_header('Content-Type', 'application/json')
        
        with urllib.request.urlopen(req, timeout=15) as response:
            data = json.loads(response.read().decode('utf-8'))
        
        if data.get('code') == 200:
            timetable_data = data.get('data', [])
            # Handle both list and dict structures
            if isinstance(timetable_data, list):
                stations = timetable_data
            else:
                stations = timetable_data.get('stations', [])
            
            return stations, None
        else:
            return None, f"API returned code: {data.get('code')}"
    
    except Exception as e:
        return None, str(e)

def extract_distances_from_timetable(stations):
    """Extract station names, distances, arrival and departure times from timetable"""
    distances = []
    train_code = None  # Will be same for all stations in a timetable
    
    for station in stations:
        station_info = station.get('station', {})
        station_name = station_info.get('stationNameEn', '').strip()
        distance_str = station.get('distance', '0')
        station_train_code = station.get('stationTrainCode', '').strip()
        
        # Capture train code from first station (should be same for all)
        if not train_code and station_train_code:
            train_code = station_train_code
        
        try:
            distance = float(distance_str) if distance_str else 0.0
        except (ValueError, TypeError):
            distance = 0.0
        
        # Extract arrival and departure times
        board_time = station.get('boardTime', '')  # Departure time
        arrival_time = station.get('arrivalTime', '')  # Arrival time
        delay_minutes = station.get('delayMinutes', 0)
        different_day = station.get('differentDay', 0)  # Day change flag (can be 0.0, 0, 1.0, 1, etc.)
        
        station_data = {
            'stationName': station_name,
            'distance': distance
        }
        
        # Add times if available
        if board_time:
            station_data['departureTime'] = board_time
        if arrival_time:
            station_data['arrivalTime'] = arrival_time
        if delay_minutes:
            station_data['delayMinutes'] = delay_minutes
        
        # Add day change flag - handle both float and int values
        # Convert to int first, then to boolean
        different_day_int = int(float(different_day)) if different_day is not None else 0
        station_data['isDayChanged'] = bool(different_day_int)
        
        # Always include dayCount (0 if no day change)
        station_data['dayCount'] = different_day_int
        
        distances.append(station_data)
    
    return distances, train_code

def main():
    """Main execution"""
    print("\n" + "=" * 80)
    print("FETCHING DISTANCE DATA FOR ROUTES FROM API")
    print("=" * 80)
    print(f"Travel Date: {TRAVEL_DATE}")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Load route searches
    routes = load_route_searches()
    print(f"✅ Loaded {len(routes)} routes from search results")
    
    # Filter routes with trains
    routes_with_trains = [r for r in routes if r.get('trainCount', 0) > 0]
    print(f"✅ {len(routes_with_trains)} routes have trains")
    
    # Collect all unique trainDirDayIds to avoid duplicate fetches
    all_train_ids = set()
    route_train_map = defaultdict(list)  # route -> list of trainDirDayIds
    
    for route in routes_with_trains:
        route_key = (route.get('origin'), route.get('destination'), route.get('direction'))
        for train in route.get('trains', []):
            train_id = train.get('trainDirDayId')
            if train_id:
                train_id_int = int(train_id) if isinstance(train_id, float) else train_id
                all_train_ids.add(train_id_int)
                route_train_map[route_key].append(train_id_int)
    
    print(f"✅ Total unique trains (trainDirDayIds): {len(all_train_ids)}")
    print(f"Estimated time: ~{len(all_train_ids) * 0.1 / 60:.1f} minutes")
    print()
    
    # Fetch timetables for all unique trains
    print("=" * 80)
    print("FETCHING TIMETABLES")
    print("=" * 80)
    
    train_timetables = {}
    successful_fetches = 0
    failed_fetches = 0
    
    for idx, train_id in enumerate(sorted(all_train_ids), 1):
        print(f"[{idx}/{len(all_train_ids)}] Fetching timetable for trainDirDayId: {train_id}", end=" ... ")
        
        stations, error = fetch_stop_timetable(train_id)
        
        if error:
            print(f"❌ {error}")
            failed_fetches += 1
            train_timetables[train_id] = {'error': error, 'stations': []}
        else:
            print(f"✅ {len(stations)} stations")
            successful_fetches += 1
            distances, train_code = extract_distances_from_timetable(stations)
            train_timetables[train_id] = {
                'stations': stations,
                'distances': distances,
                'stationCount': len(stations),
                'stationTrainCode': train_code  # Train code from timetable (e.g., "13UP")
            }
        
        # Save progress every 20 trains
        if idx % 20 == 0:
            output_file = f"route-distances-{TRAVEL_DATE.replace('-', '')}-partial.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'travelDate': TRAVEL_DATE,
                    'processed': idx,
                    'total': len(all_train_ids),
                    'successful': successful_fetches,
                    'failed': failed_fetches,
                    'trainTimetables': train_timetables
                }, f, indent=2, ensure_ascii=False)
            print(f"💾 Progress saved ({idx}/{len(all_train_ids)} trains processed)")
    
    # Organize distance data by route
    print(f"\n{'=' * 80}")
    print("ORGANIZING DISTANCE DATA BY ROUTE")
    print(f"{'=' * 80}")
    
    route_distances = []
    
    for route in routes_with_trains:
        route_key = (route.get('origin'), route.get('destination'), route.get('direction'))
        train_ids = route_train_map[route_key]
        
        route_distance_data = {
            'origin': route.get('origin'),
            'destination': route.get('destination'),
            'direction': route.get('direction'),
            'originStationCode': route.get('originStationCode'),
            'destinationStationCode': route.get('destinationStationCode'),
            'trainCount': len(train_ids),
            'trains': []
        }
        
        # For each train on this route, add distance data
        for train_id in train_ids:
            timetable = train_timetables.get(train_id, {})
            
            if 'error' in timetable:
                continue
            
            # Get trainCode from route search results (from route-searches-matched)
            train_code = None
            for train_info in route.get('trains', []):
                if train_info.get('trainDirDayId') == train_id or int(train_info.get('trainDirDayId', 0)) == int(train_id):
                    train_code = train_info.get('trainCode')
                    break
            
            train_data = {
                'trainDirDayId': train_id,
                'trainCode': train_code,  # From route search (e.g., "13UP")
                'stationTrainCode': timetable.get('stationTrainCode'),  # From timetable (e.g., "13UP")
                'stations': timetable.get('distances', []),
                'stationCount': timetable.get('stationCount', 0)
            }
            
            route_distance_data['trains'].append(train_data)
        
        route_distances.append(route_distance_data)
    
    # Save final results
    print(f"\n{'=' * 80}")
    print("SAVING RESULTS")
    print(f"{'=' * 80}")
    
    output_file = f"route-distances-{TRAVEL_DATE.replace('-', '')}.json"
    final_output = {
        'travelDate': TRAVEL_DATE,
        'completedAt': datetime.now().isoformat(),
        'totalRoutes': len(routes_with_trains),
        'totalUniqueTrains': len(all_train_ids),
        'successfulTimetableFetches': successful_fetches,
        'failedTimetableFetches': failed_fetches,
        'routes': route_distances,
        'trainTimetables': train_timetables  # Full timetables indexed by trainDirDayId
    }
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(final_output, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Saved distance data to: {output_file}")
    
    # Summary statistics
    total_stations_with_distance = sum(
        len(timetable.get('distances', []))
        for timetable in train_timetables.values()
        if 'distances' in timetable
    )
    
    print(f"\n📊 Summary:")
    print(f"  - Routes processed: {len(routes_with_trains)}")
    print(f"  - Unique trains fetched: {len(all_train_ids)}")
    print(f"  - Successful fetches: {successful_fetches}")
    print(f"  - Failed fetches: {failed_fetches}")
    print(f"  - Total stations with distance data: {total_stations_with_distance}")

if __name__ == "__main__":
    main()

