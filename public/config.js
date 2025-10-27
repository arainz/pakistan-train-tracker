// API Configuration
const API_CONFIG = {
    // Auto-detect if running in Capacitor mobile app
    getBaseURL() {
        // Check if running in Capacitor (mobile app) or if local server doesn't have API endpoints
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            // Mobile app - use Google Cloud Run production server
            return 'https://pakistan-train-tracker-174840179894.us-central1.run.app';
        } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            // Development environment - use production server for API calls
            return 'https://pakistan-train-tracker-174840179894.us-central1.run.app';
        } else {
            // Production web browser - use relative URLs (current domain)
            return '';
        }
    },

    // API endpoints
    endpoints: {
        live: '/api/live',
        schedule: '/api/schedule',
        search: '/api/search',
        train: '/api/train'
    },

    // WebSocket configuration
    getSocketURL() {
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            return 'https://pakistan-train-tracker-174840179894.us-central1.run.app';
        } else {
            return window.location.origin;
        }
    },

    // Static data configuration (Hybrid approach)
    staticData: {
        // Local bundled files (primary - fast, offline)
        local: {
            stations: '/data/stations.json',
            trains: '/data/trains.json',
            schedules: '/data/schedules.json',
            version: '/data/version.json'
        },
        // Remote source (fallback and updates - you can change this URL later)
        remote: {
            stations: 'https://trackyourtrains.com/data/StationsData.json?v=2025-06-06',
            trains: 'https://trackyourtrains.com/data/Trains.json?v=2025-06-06',
            schedules: 'https://trackyourtrains.com/data/TrainStations.json?v=2025-06-06'
        }
    },

    // Helper to fetch static data with hybrid approach
    async fetchStaticData(type, forceRemote = false) {
        const startTime = Date.now();
        console.log(`📦 [DATA SOURCE] Loading ${type} data...`);
        console.log(`📦 [DATA SOURCE] Force remote: ${forceRemote}`);
        
        // If not forcing remote, try local first
        if (!forceRemote) {
            try {
                const localPath = this.staticData.local[type];
                console.log(`📂 [DATA SOURCE] Attempting local: ${localPath}`);
                console.log(`📂 [DATA SOURCE] Full URL: ${window.location.origin}${localPath}`);
                
                const response = await fetch(localPath);
                console.log(`📂 [DATA SOURCE] Local response status: ${response.status} ${response.statusText}`);
                
                if (response.ok) {
                    const data = await response.json();
                    const loadTime = Date.now() - startTime;
                    const dataSize = JSON.stringify(data).length;
                    console.log(`✅ [DATA SOURCE] SUCCESS - Loaded ${type} from LOCAL files`);
                    console.log(`✅ [DATA SOURCE] Source: ${window.location.origin}${localPath}`);
                    console.log(`✅ [DATA SOURCE] Load time: ${loadTime}ms`);
                    console.log(`✅ [DATA SOURCE] Data size: ${(dataSize / 1024).toFixed(2)} KB`);
                    console.log(`✅ [DATA SOURCE] Records: ${Array.isArray(data) ? data.length : (data.Response?.length || 'N/A')}`);
                    return data;
                }
            } catch (error) {
                console.warn(`⚠️ [DATA SOURCE] Local ${type} not available:`, error.message);
                console.warn(`⚠️ [DATA SOURCE] Error details:`, error);
            }
        }
        
        // Fallback to remote or if forced
        try {
            const remotePath = this.staticData.remote[type];
            console.log(`🌐 [DATA SOURCE] Attempting remote: ${remotePath}`);
            console.log(`🌐 [DATA SOURCE] Fetching from internet...`);
            
            const response = await fetch(remotePath);
            console.log(`🌐 [DATA SOURCE] Remote response status: ${response.status} ${response.statusText}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            const loadTime = Date.now() - startTime;
            const dataSize = JSON.stringify(data).length;
            console.log(`✅ [DATA SOURCE] SUCCESS - Loaded ${type} from REMOTE source`);
            console.log(`✅ [DATA SOURCE] Source: ${remotePath}`);
            console.log(`✅ [DATA SOURCE] Load time: ${loadTime}ms`);
            console.log(`✅ [DATA SOURCE] Data size: ${(dataSize / 1024).toFixed(2)} KB`);
            console.log(`✅ [DATA SOURCE] Records: ${Array.isArray(data) ? data.length : (data.Response?.length || 'N/A')}`);
            return data;
        } catch (error) {
            console.error(`❌ [DATA SOURCE] FAILED to load ${type} from remote:`, error.message);
            console.error(`❌ [DATA SOURCE] Error details:`, error);
            throw error;
        }
    },

    // Check for data updates
    async checkForUpdates() {
        try {
            // Get local version
            const localVersionData = await this.fetchStaticData('version', false);
            const localVersion = localVersionData?.version || '0';
            
            // Get remote version
            const remoteVersionData = await this.fetchStaticData('version', true);
            const remoteVersion = remoteVersionData?.version || '0';
            
            console.log(`📊 Version check - Local: ${localVersion}, Remote: ${remoteVersion}`);
            
            return {
                hasUpdate: remoteVersion > localVersion,
                localVersion,
                remoteVersion
            };
        } catch (error) {
            console.warn('⚠️ Could not check for updates:', error.message);
            return { hasUpdate: false };
        }
    }
};

// Helper function to build full API URL
function getAPIUrl(endpoint) {
    const baseURL = API_CONFIG.getBaseURL();
    return baseURL + API_CONFIG.endpoints[endpoint];
}

// Helper function to build API URL with custom path
function getAPIPath(path) {
    const baseURL = API_CONFIG.getBaseURL();
    return baseURL + path;
}

// Helper function for Socket.io connection
function getSocketURL() {
    return API_CONFIG.getSocketURL();
}

// Log detailed configuration on load
console.log('═══════════════════════════════════════════════════════════');
console.log('🔧 [CONFIG] API Configuration Loaded');
console.log('═══════════════════════════════════════════════════════════');
console.log('📱 [CONFIG] Platform:', window.Capacitor && window.Capacitor.isNativePlatform() ? 'MOBILE APP (iOS/Android)' : 'WEB BROWSER');
console.log('🌐 [CONFIG] Hostname:', window.location.hostname);
console.log('🌍 [CONFIG] Origin:', window.location.origin);
console.log('📍 [CONFIG] Full URL:', window.location.href);
console.log('');
console.log('🔗 [CONFIG] API Base URL:', API_CONFIG.getBaseURL());
console.log('🔌 [CONFIG] Socket URL:', API_CONFIG.getSocketURL());
console.log('');
console.log('📂 [CONFIG] Local Data Paths:');
console.log('   Stations:', API_CONFIG.staticData.local.stations);
console.log('   Trains:', API_CONFIG.staticData.local.trains);
console.log('   Schedules:', API_CONFIG.staticData.local.schedules);
console.log('');
console.log('🌐 [CONFIG] Remote Data URLs:');
console.log('   Stations:', API_CONFIG.staticData.remote.stations);
console.log('   Trains:', API_CONFIG.staticData.remote.trains);
console.log('   Schedules:', API_CONFIG.staticData.remote.schedules);
console.log('');
console.log('💡 [CONFIG] Data Loading Strategy: HYBRID (Local First, Remote Fallback)');
console.log('═══════════════════════════════════════════════════════════');