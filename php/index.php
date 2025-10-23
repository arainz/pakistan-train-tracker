<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pakistan Train Tracker - PHP Version</title>
    <link rel="stylesheet" href="../public/style.css">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
    <link rel="icon" type="image/x-icon" href="../public/favicon.ico">
    
    <!-- Capacitor (for mobile app) -->
    <script type="module" src="https://unpkg.com/@capacitor/core@latest/dist/capacitor.js"></script>
    
    <style>
        .status-indicator {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 15px;
            border-radius: 5px;
            color: white;
            font-weight: bold;
            z-index: 1000;
            transition: all 0.3s ease;
        }
        
        .status-connected {
            background-color: #4CAF50;
        }
        
        .status-disconnected {
            background-color: #f44336;
        }
        
        .status-connecting {
            background-color: #ff9800;
        }
        
        .php-badge {
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: linear-gradient(45deg, #777BB4, #4F5B93);
            color: white;
            padding: 8px 12px;
            border-radius: 5px;
            font-size: 12px;
            font-weight: bold;
            z-index: 1000;
        }
    </style>
</head>
<body>
    <div class="status-indicator status-connecting" id="statusIndicator">
        🔄 Connecting...
    </div>
    
    <div class="php-badge">
        🐘 PHP + JavaScript Version
    </div>
    
    <div class="container">
        <header>
            <div class="header-content">
                <div class="logo">
                    <h1>🚂 Pakistan Train Tracker</h1>
                    <p>Real-time train tracking across Pakistan Railways</p>
                </div>
                <div class="stats" id="trainStats">
                    <div class="stat-item">
                        <span class="stat-number" id="totalTrains">0</span>
                        <span class="stat-label">Live Trains</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-number" id="lastUpdate">--:--</span>
                        <span class="stat-label">Last Update</span>
                    </div>
                </div>
            </div>
        </header>

        <div class="controls">
            <div class="control-group">
                <input type="text" id="searchInput" placeholder="Search trains..." class="search-input">
                <button onclick="searchTrains()" class="search-btn">🔍 Search</button>
            </div>
            <div class="control-group">
                <button onclick="refreshData()" class="refresh-btn" id="refreshBtn">🔄 Refresh</button>
                <button onclick="toggleView()" class="view-toggle" id="viewToggle">🗺️ Map View</button>
            </div>
        </div>

        <div class="content">
            <!-- Map Container -->
            <div id="mapContainer" class="map-container" style="display: none;">
                <div id="map" class="map"></div>
                <div class="map-controls">
                    <button onclick="centerMap()" class="map-btn">📍 Center</button>
                    <button onclick="toggleLayer()" class="map-btn">🔄 Layer</button>
                </div>
            </div>

            <!-- List Container -->
            <div id="listContainer" class="list-container">
                <div class="trains-grid" id="trainsGrid">
                    <div class="loading">
                        <div class="spinner"></div>
                        <p>Loading train data...</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Scripts -->
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="../public/config.js"></script>
    <script src="../public/mobile-features.js"></script>
    <script src="live-data-fetcher.js"></script>
    <script src="../public/script.js"></script>
    
    <script>
        // PHP-specific configurations
        const PHP_API_CONFIG = {
            baseURL: '',  // Same domain
            endpoints: {
                live: 'api/live',
                stations: 'api/stations', 
                trains: 'api/trains',
                schedule: 'api/schedule',
                search: 'api/search',
                train: 'api/train'
            }
        };
        
        // Override the API config for PHP version
        if (typeof API_CONFIG !== 'undefined') {
            Object.assign(API_CONFIG, PHP_API_CONFIG);
        }
        
        // Status indicator management
        function updateStatus(status, message) {
            const indicator = document.getElementById('statusIndicator');
            indicator.className = `status-indicator status-${status}`;
            
            switch(status) {
                case 'connected':
                    indicator.innerHTML = '✅ Live Data Connected';
                    break;
                case 'disconnected':
                    indicator.innerHTML = '❌ Offline Mode';
                    break;
                case 'connecting':
                    indicator.innerHTML = '🔄 ' + (message || 'Connecting...');
                    break;
            }
        }
        
        // Listen for live data updates
        window.addEventListener('liveTrainsUpdated', function(event) {
            const { trains, count, lastUpdated, isConnected } = event.detail;
            
            // Update status
            updateStatus(isConnected ? 'connected' : 'disconnected');
            
            // Update stats
            document.getElementById('totalTrains').textContent = count;
            if (lastUpdated) {
                const time = new Date(lastUpdated);
                document.getElementById('lastUpdate').textContent = time.toLocaleTimeString();
            }
            
            console.log(`📊 Updated: ${count} trains, Connected: ${isConnected}`);
        });
        
        // Enhanced refresh function for PHP version
        async function refreshData() {
            const btn = document.getElementById('refreshBtn');
            btn.disabled = true;
            btn.innerHTML = '🔄 Refreshing...';
            
            updateStatus('connecting', 'Refreshing data...');
            
            try {
                if (window.liveDataFetcher) {
                    await window.liveDataFetcher.fetchLiveData();
                }
            } catch (error) {
                console.error('Refresh error:', error);
            } finally {
                btn.disabled = false;
                btn.innerHTML = '🔄 Refresh';
            }
        }
        
        // Initialize when page loads
        document.addEventListener('DOMContentLoaded', function() {
            console.log('🐘 PHP + JavaScript version initialized');
            updateStatus('connecting', 'Initializing...');
            
            // Set up mobile features if available
            if (typeof MobileTrainTracker !== 'undefined') {
                new MobileTrainTracker();
            }
        });
        
        console.log('🚀 Pakistan Train Tracker - PHP Version Loaded');
    </script>
</body>
</html>