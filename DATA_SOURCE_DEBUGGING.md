# 📊 Data Source Debugging Guide

## How to Check Where Data is Coming From

I've added comprehensive logging to track exactly where the app loads data from. This is especially useful for debugging your iPhone app!

---

## 🔍 How to View Console Logs on iPhone

### Option 1: Safari Web Inspector (Recommended)

1. **On iPhone:**
   - Settings → Safari → Advanced → Enable "Web Inspector"

2. **On Mac:**
   - Open Safari
   - Safari → Preferences → Advanced → Check "Show Develop menu"
   - Connect iPhone via USB
   - Safari → Develop → [Your iPhone Name] → [Your App]
   - Console tab will show all logs!

### Option 2: Xcode Console (For iOS App)

1. Open Xcode
2. Window → Devices and Simulators
3. Select your iPhone
4. Click "Open Console"
5. Filter by your app name
6. All `console.log` will appear here

### Option 3: Remote Debugging

1. Open app on iPhone
2. Shake device or use debug menu
3. Logs will show in Xcode debugger

---

## 📋 What Logs to Look For

### 1. **App Configuration (Shows on Startup)**

```
═══════════════════════════════════════════════════════════
🔧 [CONFIG] API Configuration Loaded
═══════════════════════════════════════════════════════════
📱 [CONFIG] Platform: MOBILE APP (iOS/Android)
🌐 [CONFIG] Hostname: localhost
🌍 [CONFIG] Origin: capacitor://localhost
📍 [CONFIG] Full URL: capacitor://localhost/index.html

🔗 [CONFIG] API Base URL: https://pakistan-train-tracker...
🔌 [CONFIG] Socket URL: https://pakistan-train-tracker...

📂 [CONFIG] Local Data Paths:
   Stations: /data/stations.json
   Trains: /data/trains.json
   Schedules: /data/schedules.json

🌐 [CONFIG] Remote Data URLs:
   Stations: https://trackyourtrains.com/data/StationsData.json
   Trains: https://trackyourtrains.com/data/Trains.json
   Schedules: https://trackyourtrains.com/data/TrainStations.json

💡 [CONFIG] Data Loading Strategy: HYBRID (Local First, Remote Fallback)
═══════════════════════════════════════════════════════════
```

**What This Tells You:**
- ✅ If it says "MOBILE APP" → Running as iOS/Android app
- ✅ If it says "WEB BROWSER" → Running in browser
- ✅ Shows all configured URLs

---

### 2. **Static Data Loading (Schedule, Stations, Trains)**

#### Success - Loading from LOCAL files:

```
📦 [DATA SOURCE] Loading schedules data...
📦 [DATA SOURCE] Force remote: false
📂 [DATA SOURCE] Attempting local: /data/schedules.json
📂 [DATA SOURCE] Full URL: capacitor://localhost/data/schedules.json
📂 [DATA SOURCE] Local response status: 200 OK
✅ [DATA SOURCE] SUCCESS - Loaded schedules from LOCAL files
✅ [DATA SOURCE] Source: capacitor://localhost/data/schedules.json
✅ [DATA SOURCE] Load time: 45ms
✅ [DATA SOURCE] Data size: 1050.12 KB
✅ [DATA SOURCE] Records: 200
```

**What This Tells You:**
- ✅ Data loaded from bundled files (FAST!)
- ✅ Source shows `capacitor://localhost` (local)
- ✅ Load time < 100ms (very fast)
- ✅ App works offline

#### Fallback - Loading from REMOTE:

```
📦 [DATA SOURCE] Loading schedules data...
📦 [DATA SOURCE] Force remote: false
📂 [DATA SOURCE] Attempting local: /data/schedules.json
📂 [DATA SOURCE] Full URL: capacitor://localhost/data/schedules.json
⚠️ [DATA SOURCE] Local schedules not available: File not found
🌐 [DATA SOURCE] Attempting remote: https://trackyourtrains.com/data/TrainStations.json
🌐 [DATA SOURCE] Fetching from internet...
🌐 [DATA SOURCE] Remote response status: 200 OK
✅ [DATA SOURCE] SUCCESS - Loaded schedules from REMOTE source
✅ [DATA SOURCE] Source: https://trackyourtrains.com/data/TrainStations.json
✅ [DATA SOURCE] Load time: 2340ms
✅ [DATA SOURCE] Data size: 1050.12 KB
✅ [DATA SOURCE] Records: 200
```

**What This Tells You:**
- ⚠️ Local files not found (first run or missing)
- ✅ Fallback to remote worked
- ⚠️ Load time > 2 seconds (slower)
- ⚠️ Requires internet connection

---

### 3. **Live Train Data Loading**

```
🚂 [LIVE DATA] Loading live trains...
🚂 [LIVE DATA] Source URL: https://pakistan-train-tracker-174840179894.us-central1.run.app/api/live
🚂 [LIVE DATA] Full URL: https://pakistan-train-tracker-174840179894.us-central1.run.app/api/live
🚂 [LIVE DATA] Response status: 200 OK
🚂 [LIVE DATA] Response headers: {
  content-type: "application/json",
  content-length: "125640"
}
✅ [LIVE DATA] SUCCESS - Live trains loaded
✅ [LIVE DATA] Load time: 1245 ms
✅ [LIVE DATA] Response: { success: true, dataLength: 65 }
✅ [LIVE DATA] Data size: 122.70 KB
```

**What This Tells You:**
- ✅ Live data from your server
- ✅ Shows exact URL being used
- ✅ Load time and data size
- ✅ Number of trains received

---

## 🎯 Quick Diagnosis Guide

### Problem: App is slow to load schedules

**Look for:**
```
✅ [DATA SOURCE] Loaded schedules from LOCAL files
✅ [DATA SOURCE] Load time: 45ms
```
✅ **GOOD** - Fast local loading

```
✅ [DATA SOURCE] Loaded schedules from REMOTE source
✅ [DATA SOURCE] Load time: 2340ms
```
⚠️ **SLOW** - Loading from internet, local files missing

**Solution:** Make sure `public/data/` folder is included in your iOS build

---

### Problem: "Error Loading Train" or data not showing

**Look for:**
```
❌ [DATA SOURCE] FAILED to load schedules from remote
❌ [DATA SOURCE] Error details: Network request failed
```
❌ **ERROR** - No internet, remote failed, local missing

**Solution:** 
1. Check if local files are bundled
2. Check internet connection
3. Verify remote URL is accessible

---

### Problem: Not sure if using local or remote

**Search console for:**
- `LOCAL files` → Using bundled data ✅
- `REMOTE source` → Using internet data ⚠️

---

## 📱 Platform-Specific Info

### iOS App (Capacitor)

Expected logs:
```
📱 [CONFIG] Platform: MOBILE APP (iOS/Android)
🌍 [CONFIG] Origin: capacitor://localhost
📂 [DATA SOURCE] Source: capacitor://localhost/data/schedules.json
```

✅ This is correct for iOS app!

### Web Browser

Expected logs:
```
📱 [CONFIG] Platform: WEB BROWSER
🌍 [CONFIG] Origin: http://localhost:8080
📂 [DATA SOURCE] Source: http://localhost:8080/data/schedules.json
```

✅ This is correct for web browser!

---

## 🔍 Search Console for These Keywords

| Keyword | What It Shows |
|---------|---------------|
| `[CONFIG]` | App configuration on startup |
| `[DATA SOURCE]` | Static data loading (schedules, etc) |
| `[LIVE DATA]` | Live train data from API |
| `SUCCESS` | Successful data loads |
| `FAILED` | Errors |
| `LOCAL files` | Data from bundled files |
| `REMOTE source` | Data from internet |
| `Load time` | How long data took to load |

---

## 📊 Performance Benchmarks

### Expected Load Times

| Data Type | Local | Remote |
|-----------|-------|--------|
| **Stations** | < 50ms | 500-1000ms |
| **Trains** | < 50ms | 300-800ms |
| **Schedules** | < 100ms | 2000-3000ms |
| **Live Trains** | N/A | 1000-2000ms |

**If you see:**
- ✅ Local loads < 100ms → Perfect!
- ⚠️ Local loads > 500ms → Check file size/compression
- ⚠️ Remote loads > 5 seconds → Slow network

---

## 🐛 Common Issues & Solutions

### Issue 1: All data loading from REMOTE

**Console shows:**
```
⚠️ [DATA SOURCE] Local schedules not available: File not found
🌐 [DATA SOURCE] Attempting remote: https://...
```

**Cause:** Local files not bundled in iOS app

**Solution:**
```bash
# Ensure data is copied to iOS bundle
npx cap sync

# Or manually check:
# Xcode → Project → Build Phases → Copy Bundle Resources
# Make sure public/data/ folder is included
```

---

### Issue 2: "Network request failed"

**Console shows:**
```
❌ [DATA SOURCE] FAILED to load schedules from remote
❌ [DATA SOURCE] Error details: Network request failed
```

**Cause:** 
1. No internet connection
2. Local files also missing
3. Remote URL blocked/down

**Solution:**
1. Check iPhone internet connection
2. Verify local files are bundled
3. Test remote URL in Safari

---

### Issue 3: Slow app performance

**Console shows:**
```
✅ [DATA SOURCE] Load time: 3456ms
```

**Cause:** Loading from remote (slow)

**Solution:** Bundle local files to get < 100ms load times

---

## 🎯 Summary

**To check data source on your iPhone:**

1. Connect iPhone to Mac
2. Open Safari Web Inspector
3. Launch your app
4. Look at console
5. Search for `[DATA SOURCE]` or `[LIVE DATA]`
6. Check if it says:
   - `LOCAL files` ✅ (Good - Fast)
   - `REMOTE source` ⚠️ (Fallback - Slower)

**Perfect scenario (what you want to see):**
```
✅ [DATA SOURCE] SUCCESS - Loaded stations from LOCAL files
✅ [DATA SOURCE] Load time: 42ms

✅ [DATA SOURCE] SUCCESS - Loaded trains from LOCAL files
✅ [DATA SOURCE] Load time: 38ms

✅ [DATA SOURCE] SUCCESS - Loaded schedules from LOCAL files
✅ [DATA SOURCE] Load time: 87ms

✅ [LIVE DATA] SUCCESS - Live trains loaded
✅ [LIVE DATA] Load time: 1245ms
```

This means:
- ✅ Static data from local files (fast, offline)
- ✅ Live data from your API (real-time)
- ✅ Total load time < 2 seconds

---

**Last Updated:** October 27, 2025  
**Status:** Production Ready with Full Logging ✅

