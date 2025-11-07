# 🚂 Data Manager - Pakistan Train Tracker

## Overview

The Data Manager is a web-based admin panel that allows you to easily manage and update the JSON data files (`trains.json`, `stations.json`, `schedules.json`) without needing to edit files manually.

**Access:** `http://localhost:3000/admin-data-manager.html`

---

## Features

### 📊 Dashboard
- View statistics about all data files
- See total counts: Trains, Stations, Schedules
- Monitor total data size
- Validate data integrity
- Last updated timestamp

### 🚆 Trains Management
- View all trains in a table format
- Edit train information:
  - Train Number
  - Train Name (English)
  - Train Name (Urdu)
  - Description
- Add new trains
- Delete trains
- Download trains data

### 🏢 Stations Management
- View all stations in a table format
- Edit station information:
  - Station Name
  - Station Code
  - Latitude & Longitude
- Add new stations
- Delete stations
- Download stations data

### 📅 Schedules Management
- View train schedules
- See station stops per train
- Edit schedules (view JSON)
- Add new schedules (via JSON)
- Delete schedules
- Download schedules data

### 📥 Import Data
- Upload JSON files to replace existing data
- Confirmation dialog before import
- Preview imported data before saving
- Backup existing data first (recommended)

### 📤 Export Data
- Export all data as single JSON
- Export individual data types
- Automatic filename with timestamp
- Easy download and backup

### ⚙️ Settings
- Configure data sources:
  - **Local Files Only** - Use only `/public/data/` files
  - **Remote + Local** - Try local first, fallback to trackyourtrains.com
  - **Both** - Allow switching between sources
- Save preferences to browser storage

---

## How to Use

### 1. Access the Data Manager

**Local Development:**
```
http://localhost:3000/admin-data-manager.html
```

**Production:**
```
https://your-domain.com/admin-data-manager.html
```

### 2. View Dashboard

The dashboard appears on first load and shows:
- Total number of trains
- Total number of stations
- Total number of schedules
- Combined data size

**Actions:**
- Click "🔄 Refresh Stats" to reload counts
- Click "✓ Validate Data" to check for issues

### 3. Manage Trains

**View Trains:**
1. Click "🚆 Trains" in sidebar
2. All trains load in a table

**Edit Train:**
1. Click "✏️" button in the train row
2. Update information in modal
3. Click "💾 Save"

**Add Train:**
1. Click "➕ Add Train" button
2. Fill in train details
3. Click "➕ Add Train"

**Delete Train:**
1. Click "🗑️" button in the train row
2. Confirm deletion
3. Train is removed and changes saved

**Download:**
1. Click "💾 Download" button
2. Browser downloads `trains.json`

### 4. Manage Stations

**View Stations:**
1. Click "🏢 Stations" in sidebar
2. First 50 stations load (download to see all)

**Edit Station:**
1. Click "✏️" button in the station row
2. Update coordinates, name, code
3. Click "💾 Save"

**Add Station:**
1. Click "➕ Add Station" button
2. Fill in station details with coordinates
3. Click "➕ Add Station"

**Delete Station:**
1. Click "🗑️" button in the station row
2. Confirm deletion
3. Station is removed and changes saved

### 5. Manage Schedules

**View Schedules:**
1. Click "📅 Schedules" in sidebar
2. First 50 schedules load with station counts

**View Schedule Details:**
1. Click "✏️" button to see full JSON
2. Review schedule structure
3. Close modal

**Add Schedule:**
1. Click "➕ Add Schedule" button
2. Paste valid JSON schedule object
3. Click "➕ Add Schedule"

**Delete Schedule:**
1. Click "🗑️" button in the schedule row
2. Confirm deletion
3. Schedule is removed and changes saved

### 6. Import Data

**Backup First (Recommended):**
1. Go to "📤 Export" tab
2. Click "📦 Export All"
3. Save backup file

**Import:**
1. Click "📥 Import" in sidebar
2. Click upload area or drag & drop JSON file
3. Review data preview
4. Click "⚠️ Import Anyway" to confirm
5. Success message appears

### 7. Export Data

**Export All:**
1. Click "📤 Export" in sidebar
2. Click "📦 Export All"
3. File downloads with timestamp: `all-data-2025-11-07T15-30-45.json`

**Export Individual:**
- Click "🚆 Export Trains" - downloads `trains-{timestamp}.json`
- Click "🏢 Export Stations" - downloads `stations-{timestamp}.json`
- Click "📅 Export Schedules" - downloads `schedules-{timestamp}.json`

### 8. Configure Settings

**Change Data Source:**
1. Click "⚙️ Settings" in sidebar
2. Select data source option:
   - **Local Files Only** - Always use `/data/` files
   - **Both (Local + Remote)** - Try local, fallback to remote
3. Click "💾 Save Settings"
4. Settings persist in browser storage

---

## Data File Structure

### trains.json
```json
{
  "ErrorMessage": "",
  "IsSuccess": true,
  "Response": [
    {
      "TrainId": 1,
      "TrainNumber": 1,
      "TrainName": "Khyber Mail 1UP",
      "TrainNameUR": "خیبر میل 1 اپ",
      "TrainNameWithNumber": "Khyber Mail 1UP1",
      "TrainDescription": "Karachi Cantt TO Peshawar Cantt",
      "IsActive": true,
      "IsLive": true,
      "IsUp": true,
      "Imei": "9172345733"
    }
  ]
}
```

### stations.json
```json
{
  "ErrorMessage": "",
  "IsSuccess": true,
  "Response": [
    {
      "StationId": 1,
      "StationName": "Karachi Cantt",
      "StationCode": "KCT",
      "Latitude": 24.7938,
      "Longitude": 66.9910
    }
  ]
}
```

### schedules.json
```json
{
  "ErrorMessage": "",
  "IsSuccess": true,
  "Response": [
    {
      "TrainId": 1,
      "stations": [
        {
          "StationName": "Karachi Cantt",
          "DepartureTime": "07:30:00",
          "ArrivalTime": "07:30:00",
          "Distance": 0,
          "StationSequence": 1
        },
        {
          "StationName": "Hyderabad City",
          "DepartureTime": "09:15:00",
          "ArrivalTime": "09:05:00",
          "Distance": 160,
          "StationSequence": 2
        }
      ]
    }
  ]
}
```

---

## API Endpoints (for reference)

### POST /api/save-trains
Save updated trains data to `public/data/trains.json`
```bash
curl -X POST http://localhost:3000/api/save-trains \
  -H "Content-Type: application/json" \
  -d @trains.json
```

### POST /api/save-stations
Save updated stations data to `public/data/stations.json`
```bash
curl -X POST http://localhost:3000/api/save-stations \
  -H "Content-Type: application/json" \
  -d @stations.json
```

### POST /api/save-schedules
Save updated schedules data to `public/data/schedules.json`
```bash
curl -X POST http://localhost:3000/api/save-schedules \
  -H "Content-Type: application/json" \
  -d @schedules.json
```

### GET /api/data-info
Get information about data files (sizes, timestamps)
```bash
curl http://localhost:3000/api/data-info
```

---

## How Data is Used in App

### 1. Data Loading Priority

The app uses a **hybrid approach** in `config.js`:

```
Local Files (Primary)
    ↓
/public/data/trains.json
/public/data/stations.json
/public/data/schedules.json
    ↓ (if local fails or disabled)
Remote Fallback
    ↓
https://pakrail.rise.com.pk/data/
```

### 2. Server Data Sources

The server (`server.js`) loads data:

**Primary Source (currently):**
- trackyourtrains.com/data/StationsData.json
- trackyourtrains.com/data/Trains.json
- trackyourtrains.com/data/TrainStations.json

**After This Update:**
- You can now update `/public/data/` files via the admin panel
- Server can be configured to use local files as primary source
- Provides independence from external sources

### 3. Live Train Data

Live train positions come from WebSocket:
- Source: `socket.pakraillive.com`
- Real-time updates every few seconds
- Not affected by static data changes

---

## Best Practices

### ✅ DO:
- **Backup before importing** - Export data before uploading new files
- **Validate after changes** - Use "Validate Data" after major updates
- **Test in development** - Always test data changes in dev environment first
- **Keep coordinates accurate** - Use GPS coordinates for stations
- **Use proper naming** - Consistent train names and station codes
- **Export regularly** - Keep local backups of your data

### ❌ DON'T:
- **Don't edit JSON manually** - Use the admin panel for safety
- **Don't delete critical trains** - Verify before deletion
- **Don't use invalid coordinates** - Latitude/Longitude must be valid numbers
- **Don't import malformed JSON** - Validate JSON before importing
- **Don't forget to save** - Always click Save after editing

---

## Troubleshooting

### Issue: Data not saving
**Solution:**
1. Check browser console for errors (F12)
2. Verify server is running: `npm start`
3. Check file permissions on `public/data/`
4. Try exporting data and reimporting

### Issue: Can't access admin panel
**Solution:**
1. Verify URL: `http://localhost:3000/admin-data-manager.html`
2. Ensure server is running
3. Check if port 3000 is correct (see `.env`)
4. Clear browser cache

### Issue: Import fails
**Solution:**
1. Validate JSON file format (use jsonlint.com)
2. Ensure file has correct structure with "Response" field
3. Check file size - very large files may timeout
4. Try importing smaller portions

### Issue: Coordinates not updating
**Solution:**
1. Use decimal format: `24.7938` (not `24°47'38"`)
2. Latitude: -90 to +90
3. Longitude: -180 to +180
4. Example: Karachi Cantt = `24.7938, 66.9910`

---

## Integration with Mobile App

### Configuration
The mobile app (`config.js`) automatically uses local files:

```javascript
// Mobile app preference
const isMobileApp = window.Capacitor && window.Capacitor.isNativePlatform();

if (isMobileApp) {
  // ALWAYS use local files for mobile (bundled data)
  return this.staticData.local[type];
} else {
  // Web browser can use local first, then remote
  // Try local first, fallback to remote if needed
}
```

### Benefits
- ✅ No internet required (offline mode)
- ✅ Faster loading (local files)
- ✅ Independent from external sources
- ✅ Can update data via admin panel

---

## Server Configuration

### Enable Local Data as Primary
Edit `server.js` to use local files:

```javascript
// Option 1: Use local files from public/data/
const dataDir = path.join(__dirname, 'public', 'data');

// Option 2: Load from local files instead of trackyourtrains.com
async function fetchStaticData() {
  // Load from public/data/ instead of external URL
  data.trains = require('./public/data/trains.json');
  data.stations = require('./public/data/stations.json');
  data.trainStations = require('./public/data/schedules.json');
}
```

### Scheduled Updates
Currently, server refreshes data hourly from trackyourtrains.com:

```javascript
// Every hour
cron.schedule('0 * * * *', () => {
  console.log('Refreshing static data...');
  fetchStaticData();
});
```

You can change this to refresh from local files instead.

---

## Future Enhancements

Potential improvements:
- [ ] Backup/Restore functionality
- [ ] Data validation rules
- [ ] Bulk edit operations
- [ ] Data versioning/history
- [ ] Undo/Redo functionality
- [ ] User authentication
- [ ] Data sync across servers
- [ ] Real-time collaboration

---

## Support

For issues or questions:
1. Check the Troubleshooting section above
2. Review server console logs
3. Check browser developer console (F12)
4. Verify data file integrity
5. Contact development team

---

**Last Updated:** November 7, 2025
**Version:** 1.0
**Status:** Production Ready ✅
