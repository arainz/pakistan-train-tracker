# PHP Deployment Guide for Pakistan Train Tracker

## Overview
This is a PHP + JavaScript version of the Pakistan Train Tracker that can be deployed on any shared hosting provider (like Hostinger, cPanel, etc.) without requiring Node.js.

## Features
- ✅ **PHP Backend**: Compatible with all shared hosting providers
- ✅ **JavaScript Live Data**: Real-time data fetching using browser-based Socket.IO
- ✅ **File Caching**: Automatic caching to reduce API calls
- ✅ **CORS Support**: Proper cross-origin resource sharing
- ✅ **Mobile App Support**: Works with Capacitor mobile app
- ✅ **Offline Fallback**: Graceful degradation when live data is unavailable

## File Structure
```
php/
├── api.php              # Main PHP API handler
├── .htaccess           # Apache rewrite rules
├── index.php           # Main HTML page
├── live-data-fetcher.js # JavaScript live data fetcher
├── cache/              # Auto-created cache directory
└── DEPLOYMENT.md       # This file
```

## Deployment Steps

### 1. Upload Files
Upload the entire `php/` folder contents to your web hosting directory:
- Via cPanel File Manager
- Via FTP client (FileZilla, WinSCP, etc.)
- Via hosting provider's upload interface

### 2. Set Permissions
Ensure proper permissions:
```bash
chmod 755 php/
chmod 644 php/*.php
chmod 644 php/*.js  
chmod 644 php/.htaccess
chmod 777 php/cache/  # Will be auto-created if doesn't exist
```

### 3. Configure Domain
Point your domain/subdomain to the `php/` directory, or access via:
```
https://yourdomain.com/php/
```

### 4. Test Installation
Visit your domain and check:
- ✅ Main page loads
- ✅ API endpoints work: `/api/trains`, `/api/stations`, `/api/live`
- ✅ Live data fetcher initializes
- ✅ Cache directory is created automatically

## API Endpoints

### Base URL: `https://yourdomain.com/php/`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/live` | GET | Get live train data |
| `/api/trains` | GET | Get all trains |
| `/api/stations` | GET | Get all stations |
| `/api/schedule` | GET | Get train schedules |
| `/api/search?query=term` | GET | Search trains |
| `/api/train/{id}` | GET | Get specific train details |

## Mobile App Configuration

Update your mobile app's `config.js`:

```javascript
const API_CONFIG = {
    getBaseURL() {
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            // Mobile app - use your PHP hosting URL
            return 'https://yourdomain.com/php';
        } else {
            return '';
        }
    },
    // ... rest of config
};
```

## Caching System

### Static Data Cache
- **Duration**: 1 hour
- **Files**: `cache/trains.json`, `cache/stations.json`, `cache/schedule.json`
- **Auto-refresh**: When cache expires

### Live Data Cache
- **Duration**: 1 minute
- **Method**: JavaScript-based real-time fetching
- **Fallback**: Sample data when live data unavailable

## Performance Optimization

### 1. Enable Gzip Compression
Add to `.htaccess`:
```apache
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/plain
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/xml
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE application/xml
    AddOutputFilterByType DEFLATE application/xhtml+xml
    AddOutputFilterByType DEFLATE application/rss+xml
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/x-javascript
    AddOutputFilterByType DEFLATE application/json
</IfModule>
```

### 2. Browser Caching
Add to `.htaccess`:
```apache
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType text/css "access plus 1 week"
    ExpiresByType application/javascript "access plus 1 week"
    ExpiresByType image/png "access plus 1 month"
    ExpiresByType image/jpg "access plus 1 month"
    ExpiresByType image/jpeg "access plus 1 month"
    ExpiresByType image/gif "access plus 1 month"
</IfModule>
```

### 3. PHP Optimization
Ensure PHP settings:
```ini
memory_limit = 128M
max_execution_time = 30
allow_url_fopen = On
```

## Troubleshooting

### Issue: "500 Internal Server Error"
**Solution**: Check file permissions and PHP error logs

### Issue: "Cache directory not writable"
**Solution**: Set cache directory permissions to 777
```bash
chmod 777 php/cache/
```

### Issue: "API returns empty data"
**Solution**: 
1. Check if `allow_url_fopen` is enabled in PHP
2. Verify internet connectivity from server
3. Check if external APIs are accessible

### Issue: "CORS errors in browser"
**Solution**: Verify `.htaccess` CORS headers are properly configured

### Issue: "Live data not updating"
**Solution**: 
1. Check browser console for JavaScript errors
2. Verify Socket.IO endpoints are accessible
3. Try manual refresh

## Monitoring

### Check API Health
Visit: `https://yourdomain.com/php/api`

Expected response:
```json
{
  "success": true,
  "message": "Pakistan Train Tracker PHP API",
  "version": "1.0.0",
  "endpoints": {...}
}
```

### Check Cache Status
Cache files location: `php/cache/`
- `trains.json` - Train data
- `stations.json` - Station data  
- `schedule.json` - Schedule data

### Monitor Live Data
Browser Console should show:
```
🚀 Initializing Live Data Fetcher...
📊 Loading static data...
✅ Loaded X trains, Y stations
📡 Fetching live train data via Socket.IO polling...
✅ Successfully fetched Z live trains
```

## Advanced Configuration

### Custom Cache Duration
Edit `api.php`:
```php
$CACHE_DURATION = 7200; // 2 hours for static data
$LIVE_CACHE_DURATION = 120; // 2 minutes for live data
```

### Custom Socket.IO Endpoint
Edit `live-data-fetcher.js`:
```javascript
this.socketUrl = 'https://your-custom-socket-server.com';
```

### Custom Update Interval
Edit `live-data-fetcher.js`:
```javascript
this.updateInterval = 60000; // 1 minute updates
```

## Support
For issues or questions, check:
1. Browser console for JavaScript errors
2. Server error logs for PHP issues
3. Network tab for API request failures
4. Cache directory for file permissions

## Requirements
- **PHP**: 7.4+ (8.0+ recommended)
- **Apache**: mod_rewrite enabled
- **Extensions**: curl, json (usually enabled by default)
- **Functions**: file_get_contents, allow_url_fopen
- **Permissions**: Write access for cache directory