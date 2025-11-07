# 🚀 Setup Local Data Management

## What's New

You now have a complete data management system that allows you to:

1. **Manage data files** via web admin panel (no manual JSON editing)
2. **Use local `/public/data/` files** as primary data source (instead of trackyourtrains.com)
3. **Update data easily** - Add, edit, delete trains, stations, schedules
4. **Export/Import** - Backup and restore data with one click
5. **Independent operation** - Works without relying on external APIs

---

## Quick Start

### 1. Start the Server
```bash
cd /Users/abdulnasir/Data/AbdulNasir/Projects/PS/CodeHelp/Rail
npm start
```

Server runs on: `http://localhost:3000`

### 2. Access Data Manager
Open in browser:
```
http://localhost:3000/admin-data-manager.html
```

### 3. View Dashboard
You'll see:
- Total Trains count
- Total Stations count
- Total Schedules count
- Data file sizes

---

## File Structure

```
public/
├── data/
│   ├── trains.json          ← Edit via admin panel
│   ├── stations.json        ← Edit via admin panel
│   ├── schedules.json       ← Edit via admin panel
│   └── version.json         ← Version tracking
└── admin-data-manager.html  ← Admin panel
```

---

## Admin Panel Features

### 📊 Dashboard Tab
- View data statistics
- Validate data integrity
- Refresh stats

### 🚆 Trains Tab
- View all trains in table
- ✏️ Edit train
- 🗑️ Delete train
- ➕ Add train
- 💾 Download trains.json

### 🏢 Stations Tab
- View all stations (first 50)
- ✏️ Edit station
- 🗑️ Delete station
- ➕ Add station
- 💾 Download stations.json

### 📅 Schedules Tab
- View all schedules (first 50)
- 👁️ View schedule details
- 🗑️ Delete schedule
- ➕ Add schedule
- 💾 Download schedules.json

### 📥 Import Tab
- Upload JSON files
- Confirm before replacing data
- Preview imported data

### 📤 Export Tab
- Export all data
- Export individual files
- Downloads with timestamp

### ⚙️ Settings Tab
- Choose data source:
  - Local files only
  - Local + remote fallback
  - Both options

---

## Data Management Tasks

### Task 1: View All Trains
1. Go to admin panel
2. Click "🚆 Trains"
3. See table with all trains
4. Each train shows: ID, Number, Name, Urdu, Description, Status

### Task 2: Add a New Train
1. Click "➕ Add Train"
2. Fill in details:
   - Train Number: `13` (UP means upbound, DN means downbound)
   - Train Name: `Awam Express 13UP`
   - Train Name (Urdu): `عوام اکسپریس 13 اپ`
   - Description: `Karachi Cantt TO Peshawar Cantt`
3. Click "➕ Add Train"
4. Success message appears

### Task 3: Update Train Information
1. Find train in table
2. Click "✏️" button
3. Edit fields (Name, Urdu, Description)
4. Click "💾 Save"
5. Changes saved to trains.json

### Task 4: Add a New Station
1. Click "🏢 Stations"
2. Click "➕ Add Station"
3. Fill in:
   - Station Name: `Karachi Cantt`
   - Station Code: `KCT`
   - Latitude: `24.7938`
   - Longitude: `66.9910`
4. Click "➕ Add Station"

### Task 5: Create a Train Schedule
1. Click "📅 Schedules"
2. Click "➕ Add Schedule"
3. Paste JSON schedule:
```json
{
  "TrainId": 13,
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
```
4. Click "➕ Add Schedule"

### Task 6: Backup All Data
1. Click "📤 Export"
2. Click "📦 Export All"
3. File downloads: `all-data-2025-11-07T15-30-45.json`
4. Save to safe location

### Task 7: Restore from Backup
1. Click "📥 Import"
2. Click upload area
3. Select backup JSON file
4. Click "⚠️ Import Anyway" to confirm
5. Data restored

---

## How App Uses This Data

### Application Flow

```
Mobile App / Web Browser
    ↓
Tries to load data from:
    ↓
1. Local files (/data/*.json) ✅
    ↓ (if local fails)
2. Remote fallback (pakrail.rise.com.pk) ✅
    ↓ (if both fail)
3. Shows error

Live Train Data
    ↓
Always from WebSocket (socket.pakraillive.com)
    ↓
Real-time updates every few seconds
```

### Data Sources Priority

**Mobile App (iOS/Android):**
1. Local bundled files (`/data/*.json`) - ONLY option
2. No internet needed (offline capable)

**Web Browser:**
1. Try local files first (`/data/*.json`)
2. Fallback to remote if needed
3. Can be configured in Settings

---

## Server Configuration

### Current Setup
Server (`server.js`) loads from:
- `https://trackyourtrains.com/data/StationsData.json`
- `https://trackyourtrains.com/data/Trains.json`
- `https://trackyourtrains.com/data/TrainStations.json`

### Switch to Local Files
To use `/public/data/` files as primary source, modify `server.js`:

**Before:**
```javascript
const stationsResponse = await axios.get(`${DATA_BASE_URL}/StationsData.json`);
```

**After:**
```javascript
const stationsResponse = await fetch('/data/stations.json').then(r => r.json());
```

---

## API Endpoints Added

### 1. POST /api/save-trains
Save trains data after editing
```bash
curl -X POST http://localhost:3000/api/save-trains \
  -H "Content-Type: application/json" \
  -d @trains.json
```

### 2. POST /api/save-stations
Save stations data after editing
```bash
curl -X POST http://localhost:3000/api/save-stations \
  -H "Content-Type: application/json" \
  -d @stations.json
```

### 3. POST /api/save-schedules
Save schedules data after editing
```bash
curl -X POST http://localhost:3000/api/save-schedules \
  -H "Content-Type: application/json" \
  -d @schedules.json
```

### 4. GET /api/data-info
Get info about data files
```bash
curl http://localhost:3000/api/data-info
```

---

## Workflow Examples

### Workflow 1: Update Train Schedule

```
1. Receive new schedule from Pakistan Railways
   ↓
2. Open admin panel → Schedules tab
   ↓
3. Click ➕ Add Schedule
   ↓
4. Paste JSON with new stations and times
   ↓
5. Click ➕ Add Schedule
   ↓
6. App automatically uses updated data
   ↓
7. Mobile app gets update when it refreshes
```

### Workflow 2: Fix Wrong Station Coordinates

```
1. Discover station coordinates are wrong
   ↓
2. Open admin panel → Stations tab
   ↓
3. Find station in table
   ↓
4. Click ✏️ Edit
   ↓
5. Update Latitude and Longitude
   ↓
6. Click 💾 Save
   ↓
7. Live map updates immediately
```

### Workflow 3: Add New Train Service

```
1. Pakistan Railways adds new train (Train #50)
   ↓
2. Open admin panel → Trains tab
   ↓
3. Click ➕ Add Train
   ↓
4. Enter: Number, Name, Urdu name, Description
   ↓
5. Click ➕ Add Train
   ↓
6. Go to Schedules tab
   ↓
7. Click ➕ Add Schedule
   ↓
8. Paste schedule with all stations
   ↓
9. Train appears in app live tracking
```

### Workflow 4: Backup Before Major Changes

```
1. About to make lots of changes
   ↓
2. Open admin panel → Export tab
   ↓
3. Click 📦 Export All
   ↓
4. Save file: backup-2025-11-07.json
   ↓
5. Now safe to make changes
   ↓
6. If something breaks, Import from backup
   ↓
7. All data restored instantly
```

---

## Advantages Over Old System

| Feature | Old System | New System |
|---------|-----------|-----------|
| **Data Source** | trackyourtrains.com only | Local + Remote options |
| **Editing** | Manual JSON files | Web admin panel |
| **Backup** | Manual copy/paste | One-click export |
| **Restore** | Complicated | One-click import |
| **Add Data** | Edit files manually | Form-based UI |
| **Delete Data** | Edit files manually | Simple buttons |
| **Validation** | Manual checking | Auto validate |
| **Mobile Sync** | Depends on external API | Works offline with local files |
| **Offline Mode** | Limited | Full support |

---

## Common Tasks Cheat Sheet

### 📝 Edit Train Name
```
Trains tab → Find train → ✏️ Edit → Change name → 💾 Save
```

### ➕ Add New Train
```
Trains tab → ➕ Add Train → Fill form → ➕ Add Train
```

### 🗑️ Delete Train
```
Trains tab → Find train → 🗑️ Delete → Confirm
```

### 📥 Restore Data
```
Export tab → 📤 Export All (first backup) →
Import tab → Upload file → 📥 Import
```

### 🔍 View All Stations
```
Stations tab → 💾 Download → Open in text editor or Excel
```

### 📊 Check Data Health
```
Dashboard → ✓ Validate Data → See results
```

---

## Troubleshooting

**Problem:** Can't access admin panel
- Solution: Check URL: `http://localhost:3000/admin-data-manager.html`
- Check server running: `npm start`

**Problem:** Changes not saving
- Solution: Check browser console (F12) for errors
- Verify file permissions on `/public/data/`

**Problem:** Data corrupted after import
- Solution: Export → Import from backup file

**Problem:** Coordinates showing wrong on map
- Solution: Use decimal format (e.g., 24.7938, 66.9910)

---

## Next Steps

1. ✅ Access admin panel at `http://localhost:3000/admin-data-manager.html`
2. ✅ View current data on Dashboard
3. ✅ Export backup of all data
4. ✅ Try editing one station
5. ✅ Try adding one new train
6. ✅ Test import/export workflow
7. ✅ Configure data source preference in Settings

---

## Files Modified/Created

**New Files:**
- `public/admin-data-manager.html` - Admin panel (1500+ lines)
- `DATA_MANAGER_README.md` - Full documentation
- `SETUP_LOCAL_DATA.md` - This file

**Modified Files:**
- `server.js` - Added 3 POST endpoints + 1 GET endpoint
  - `POST /api/save-trains`
  - `POST /api/save-stations`
  - `POST /api/save-schedules`
  - `GET /api/data-info`

**Existing Files (No changes needed):**
- `config.js` - Already supports local files (working as-is)
- `public/data/trains.json` - Now editable via admin panel
- `public/data/stations.json` - Now editable via admin panel
- `public/data/schedules.json` - Now editable via admin panel

---

**Status:** ✅ Ready to Use
**Last Updated:** November 7, 2025
**Version:** 1.0
