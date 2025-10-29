# 🔄 Server Redundancy Setup

Your app now has **automatic failover** between primary (Google Cloud Run) and fallback (Koyeb) servers!

## 🎯 How It Works

### Server Configuration:
- **Primary:** Google Cloud Run (paid, always-on, fast)
- **Fallback:** Koyeb (free, always-on)

### Automatic Switching:
1. App starts → tries **Primary** server first
2. If Primary fails → automatically switches to **Fallback**
3. Every 5 minutes → checks if Primary is back online
4. Primary recovers → automatically switches back to **Primary**

## 📋 Setup Koyeb Fallback Server

### Step 1: Deploy to Koyeb

1. Go to **https://app.koyeb.com**
2. Sign up/Login with GitHub
3. Click **"Deploy"** → **"GitHub"**
4. Select repository: `pakistan-train-tracker`
5. Configure:
   - **Build command:** `npm install`
   - **Run command:** `npm start`
   - **Port:** `8000`
   - **Instance:** Eco (free)
   - **Region:** Singapore or closest to Pakistan
6. Click **"Deploy"**
7. Wait 2-3 minutes for deployment

### Step 2: Get Your Koyeb URL

After deployment, you'll get a URL like:
```
https://pakistan-train-tracker-yourname.koyeb.app
```

### Step 3: Update config.js

Replace `YOURNAME` in `public/config.js` line 6:

```javascript
fallback: 'https://pakistan-train-tracker-yourname.koyeb.app',
```

### Step 4: Commit & Deploy

```bash
git add public/config.js
git commit -m "Add Koyeb fallback server"
git push

# Update mobile app
npx cap copy ios
npx cap sync ios
```

## 🧪 Testing Fallback

### Test 1: Normal Operation
```bash
# Open app → Check console logs
# Should see:
✅ Now using primary server: https://...run.app
```

### Test 2: Primary Server Down
```bash
# Simulate primary failure (turn off Cloud Run temporarily)
# App should show:
⚠️ Primary server unavailable, switching to fallback...
✅ Now using fallback server: https://...koyeb.app
✅ Fallback server responded successfully
```

### Test 3: Primary Recovery
```bash
# Turn Cloud Run back on
# After 5 minutes, app should show:
✅ Primary server is back online, switching to primary...
✅ Now using primary server: https://...run.app
```

## 📊 Benefits

| Feature | Before | After |
|---------|--------|-------|
| **Uptime** | ~99% (single server) | ~99.99% (redundant) |
| **Recovery** | Manual restart | Automatic failover |
| **Cost** | $5-10/month | Same + FREE fallback |
| **Downtime** | Minutes to hours | Seconds |

## 🔍 Monitoring

### Console Logs to Watch:

```javascript
// Server status
🔗 [CONFIG] Primary Server: https://...run.app
🔗 [CONFIG] Fallback Server: https://...koyeb.app
🔗 [CONFIG] Active Server: https://...run.app (or koyeb.app)

// Switching events
⚠️ Primary server unavailable, switching to fallback...
✅ Fallback server responded successfully
✅ Primary server is back online, switching to primary...
```

## 🛠️ Optional: Use fetchWithFallback()

For critical API calls in your code, you can use the enhanced fetch:

```javascript
// Instead of:
const response = await fetch(getAPIUrl('live'));

// Use (with automatic fallback):
const response = await fetchWithFallback(getAPIUrl('live'));
```

This is **optional** - regular `fetch()` will still work because the server URL automatically switches.

## 💡 How to Use ONLY Koyeb (100% Free)

If you want to save $5-10/month and use only Koyeb:

```javascript
// In config.js, swap primary and fallback:
servers: {
    primary: 'https://pakistan-train-tracker-yourname.koyeb.app', // Koyeb
    fallback: 'https://pakistan-train-tracker-174840179894.us-central1.run.app', // Cloud Run
}
```

Now Koyeb is primary (free) and Cloud Run is fallback (paid backup).

## 🚨 Troubleshooting

### Fallback not working?
1. Check Koyeb deployment status
2. Verify Koyeb URL in `config.js` is correct
3. Test Koyeb manually: `curl https://your-app.koyeb.app/api/live`

### Both servers down?
```javascript
// App will show:
❌ Both primary and fallback servers are unavailable
```
Check:
1. Internet connection
2. Both server statuses (Cloud Run + Koyeb dashboards)

### Stuck on fallback?
```javascript
// Manually force switch back to primary:
API_CONFIG.switchToPrimary();
```

## 📈 Future Enhancements

Possible improvements:
- Add third fallback server (Railway/Fly.io)
- Implement load balancing (distribute traffic)
- Add server response time tracking
- Show server status in app UI

---

**Your app now has enterprise-level redundancy! 🎉**

