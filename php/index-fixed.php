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
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            min-height: 100vh;
        }
        
        header {
            background: linear-gradient(135deg, #2E7D32, #4CAF50);
            color: white;
            padding: 20px;
        }
        
        .header-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 20px;
        }
        
        .logo h1 {
            margin: 0;
            font-size: 28px;
        }
        
        .logo p {
            margin: 5px 0 0 0;
            opacity: 0.9;
            font-size: 14px;
        }
        
        .stats {
            display: flex;
            gap: 30px;
        }
        
        .stat-item {
            text-align: center;
        }
        
        .stat-number {
            display: block;
            font-size: 24px;
            font-weight: bold;
        }
        
        .stat-label {
            font-size: 12px;
            opacity: 0.8;
        }
        
        .controls {
            padding: 20px;
            background: #f8f8f8;
            border-bottom: 1px solid #ddd;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 15px;
        }
        
        .control-group {
            display: flex;
            gap: 10px;
            align-items: center;
        }
        
        .search-input {
            padding: 10px 15px;
            border: 1px solid #ddd;
            border-radius: 5px;
            width: 200px;
            font-size: 14px;
        }
        
        .search-btn, .refresh-btn, .view-toggle {
            padding: 10px 15px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: background-color 0.3s;
        }
        
        .search-btn, .refresh-btn {
            background: #4CAF50;
            color: white;
        }
        
        .search-btn:hover, .refresh-btn:hover {
            background: #45a049;
        }
        
        .view-toggle {
            background: #2196F3;
            color: white;
        }
        
        .view-toggle:hover {
            background: #1976D2;
        }
        
        .content {
            padding: 20px;
        }
        
        .trains-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 20px;
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
            </div>
        </div>

        <div class="content">
            <div class="trains-grid" id="trainsGrid">
                <div class="loading">
                    <div class="spinner"></div>
                    <p>Loading train data...</p>
                </div>
            </div>
        </div>
    </div>

    <!-- Scripts -->
    <script src="browser-live-fetcher.js"></script>
    
    <script>
        console.log('🐘 Pakistan Train Tracker - PHP Version');
        
        // Enhanced refresh function
        async function refreshData() {
            const btn = document.getElementById('refreshBtn');
            btn.disabled = true;
            btn.innerHTML = '🔄 Refreshing...';
            
            try {
                if (window.simpleDataLoader) {
                    await window.simpleDataLoader.refreshData();
                }
            } catch (error) {
                console.error('Refresh error:', error);
            } finally {
                btn.disabled = false;
                btn.innerHTML = '🔄 Refresh';
            }
        }
        
        // Search function
        function searchTrains() {
            const query = document.getElementById('searchInput').value;
            console.log('Searching for:', query);
            
            if (window.simpleDataLoader) {
                const results = window.simpleDataLoader.searchTrains(query);
                console.log('Search results:', results.length);
                // For now, just log results. You can implement search UI later.
            }
        }
        
        // Listen for Enter key in search
        document.getElementById('searchInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchTrains();
            }
        });
        
        console.log('🚀 Page scripts loaded');
    </script>
</body>
</html>