# Train Data Directory

This directory contains static train schedule data used by the app with a **hybrid approach**.

## Files

- `stations.json` - List of all railway stations (~115KB)
- `trains.json` - Train metadata (names, numbers) (~75KB)
- `schedules.json` - Complete train schedules and routes (~1MB)
- `version.json` - Version metadata for update checking

**Total Size:** ~1.2MB (compressed: ~300KB with gzip)

## Hybrid Data Loading Strategy

The app uses a **two-tier data loading strategy**:

### 1. Primary: Local Files (Fast & Offline)
- Files are bundled with the app
- Instant loading (<100ms)
- Works offline
- 100% reliable

### 2. Fallback: Remote Source (Updates)
- Checks `trackyourtrains.com` for updates
- Updates available without app store submission
- Auto-updates in background
- Graceful degradation if remote fails

## How It Works

```javascript
// App tries to load data:
1. Try local files first (instant) ✅
2. If local fails → fetch from remote ✅
3. Check for updates in background 🔄
4. Cache updates for next launch 💾
```

## Updating Data

### Manual Update (Recommended)

Run this command to download latest data:

```bash
cd /path/to/Rail
curl "https://trackyourtrains.com/data/StationsData.json?v=$(date +%Y-%m-%d)" -o public/data/stations.json
curl "https://trackyourtrains.com/data/Trains.json?v=$(date +%Y-%m-%d)" -o public/data/trains.json
curl "https://trackyourtrains.com/data/TrainStations.json?v=$(date +%Y-%m-%d)" -o public/data/schedules.json
echo "{\"version\":\"$(date +%Y%m%d)\",\"lastUpdated\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"source\":\"trackyourtrains.com\"}" > public/data/version.json

# Commit changes
git add public/data/
git commit -m "Update train data - $(date +%Y-%m-%d)"
git push
```

### Change Remote URL

To use your own data source instead of trackyourtrains.com:

1. Edit `public/config.js`
2. Find `staticData.remote` section
3. Change URLs to your source:

```javascript
remote: {
    stations: 'https://your-url.com/stations.json',
    trains: 'https://your-url.com/trains.json',
    schedules: 'https://your-url.com/schedules.json'
}
```

## Update Frequency

- **Major changes:** 2-4 times per year (seasonal schedules)
- **Minor changes:** Monthly (route adjustments)
- **Station data:** Rarely (yearly or less)

**Recommended:** Update monthly or when Pakistan Railways announces changes.

## Benefits

✅ **Fast Loading** - Local files load in <100ms  
✅ **Offline Support** - Works without internet  
✅ **Auto Updates** - Mobile apps get updates without app store  
✅ **Reliable** - No external dependencies  
✅ **Version Control** - Track changes in git  
✅ **Cost Effective** - No API costs for static data  

## File Formats

All files are in JSON format with the following structures:

### stations.json
```json
{
  "Response": [
    {
      "StationId": "...",
      "StationName": "Karachi City",
      "Latitude": "...",
      "Longitude": "..."
    }
  ]
}
```

### trains.json
```json
{
  "Response": [
    {
      "TrainId": "19900",
      "TrainNumber": "1",
      "TrainName": "Khyber Mail",
      "TrainNameUrdu": "..."
    }
  ]
}
```

### schedules.json
```json
{
  "Response": [
    {
      "TrainId": "19900",
      "stations": [
        {
          "StationName": "Karachi City",
          "ArrivalTime": "08:00",
          "DepartureTime": "08:05",
          "Distance": 0,
          "Day": 1
        }
      ]
    }
  ]
}
```

### version.json
```json
{
  "version": "20251027",
  "lastUpdated": "2025-10-27T04:24:26Z",
  "source": "trackyourtrains.com"
}
```

## Troubleshooting

**Problem:** App shows "Unable to load train schedules"  
**Solution:** Check if files exist and are valid JSON

**Problem:** Data seems outdated  
**Solution:** Run the update command above

**Problem:** Remote URL not working  
**Solution:** App will use local files automatically (fallback)

## Last Updated

**Version:** 20251027  
**Date:** October 27, 2025  
**Source:** trackyourtrains.com

