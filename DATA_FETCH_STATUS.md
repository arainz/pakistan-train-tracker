# Data Fetch Status Report

**Date**: October 30, 2025  
**Restored to Commit**: `48cfbf5` (Update server priority: Google Cloud → Oracle → Koyeb)

## Current Situation

### Pakistan Railways Official API Status

The Pakistan Railways Official API (`https://isapi.pakrailways.gov.pk`) is currently **NOT returning train schedule data**.

#### What Works:
✅ **Stations API** - Successfully fetched **298 stations**
  - Endpoint: `/v1/ticket/getStations`
  - Format changed from `{data: [...]}` to `{rows: [...]}`

#### What Doesn't Work:
❌ **Train Search API** - Returns **0 trains** for all routes
  - Endpoint: `/v1/ticket/trainInfo/trainInfoList`
  - Tested multiple routes (Karachi-Lahore, Lahore-Peshawar, etc.)
  - All return `{rows: []}`

❌ **Schedule Details API** - Cannot be tested without journey IDs
  - Endpoint: `/v1/ticket/trainInfo/stopTimeTable/:journeyId`
  - Requires journey IDs from train search

### Current Data Files

**OLD Data** (from commit `48cfbf5`):
- `public/data/schedules.json`: **164 schedules**
- `public/data/stations.json`: Contains station data
- `public/data/trains.json`: Contains train data

**NEW Data** (from API fetch attempt):
- `/tmp/merge_data/new_stations.json`: **298 stations** ✅
- `/tmp/merge_data/new_schedules.json`: **0 schedules** ❌

## Train 13UP ("Awam Express") Status

From OLD data (`/tmp/merge_data/old_schedules.json`):
- **Departure Time**: 07:30:00 (from Karachi Cantt)
- **Status**: This is the only available data source currently

## Recommendations

### Option 1: Keep Existing Data (Recommended)
Since the Pakistan Railways API is not returning schedule data, we should:
1. Keep the existing OLD data files as-is
2. Fix the server matching bug (undefined === undefined)
3. Monitor the Pakistan Railways API and retry fetch when it's working

### Option 2: Wait for API
- Pakistan Railways API might be temporarily down
- Could retry in a few hours/days
- No schedule updates possible until API is working

### Option 3: Manual Data Entry
- If official API remains unavailable
- Manually verify and update critical trains (like Train 13UP)
- Update schedules based on official Pakistan Railways website

## Server Fix Applied

✅ **Fixed** the `/api/train/:identifier` endpoint matching bug:
```javascript
// OLD (buggy):
ts.TrainId === train.TrainCode  // matched when both undefined

// NEW (fixed):
if (train.TrainCode && ts.TrainId === train.TrainCode) return true;
```

This ensures Train 13 correctly shows its schedule instead of returning Train 1's schedule.

## Next Steps

**Immediate**:
1. ✅ Server matching bug is fixed
2. ⏳ Keep monitoring Pakistan Railways API
3. ⏳ Use existing OLD data for now

**When API is working**:
1. Run `node fetch-new-data.js` to get fresh schedules
2. Create merge script to update times and distances
3. Note any station count differences per train
4. Deploy updated data

## Commands for Future Use

### Fetch New Data (when API is working):
```bash
node fetch-new-data.js
```

### Check Data Counts:
```bash
# OLD data
cat /tmp/merge_data/old_schedules.json | jq 'length'

# NEW data  
cat /tmp/merge_data/new_schedules.json | jq '.Response | length'
```

### Test API Status:
```bash
# Check stations (working)
curl -s 'https://isapi.pakrailways.gov.pk/v1/ticket/getStations' | jq '{count: (.rows | length)}'

# Check trains (currently broken)
curl -s 'https://isapi.pakrailways.gov.pk/v1/ticket/trainInfo/trainInfoList' \
  -H 'Content-Type: application/json' \
  --data-raw '{"boardStationCode":"KCT","arrivalStationCode":"LHR","travelDate":"2025-10-31"}' \
  | jq '{count: (.rows | length)}'
```



