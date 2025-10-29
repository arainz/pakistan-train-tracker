// API Configuration
const API_CONFIG = {
    // Primary and fallback servers
    servers: {
        primary: 'https://pakistan-train-tracker-174840179894.us-central1.run.app', // Google Cloud Run
        fallback: 'https://confused-eel-pakrail-7ab69761.koyeb.app', // Koyeb (free tier)
    },
    
    // Current active server (will switch on failure)
    _currentServer: null,
    _serverStatus: {
        primary: true,  // Assume primary is available initially
        fallback: true
    },
    
    // Auto-detect if running in Capacitor mobile app
    getBaseURL() {
        // Check if running in Capacitor (mobile app) or if local server doesn't have API endpoints
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            // Mobile app - use primary server (with automatic fallback)
            return this._currentServer || this.servers.primary;
        } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            // Development environment - use primary server (with automatic fallback)
            return this._currentServer || this.servers.primary;
        } else {
            // Production web browser - use relative URLs (current domain)
            return '';
        }
    },
    
    // Switch to fallback server
    switchToFallback() {
        console.warn('⚠️ Primary server unavailable, switching to fallback...');
        this._currentServer = this.servers.fallback;
        this._serverStatus.primary = false;
        console.log(`✅ Now using fallback server: ${this.servers.fallback}`);
    },
    
    // Switch back to primary server
    switchToPrimary() {
        console.log('✅ Primary server is back online, switching to primary...');
        this._currentServer = this.servers.primary;
        this._serverStatus.primary = true;
        console.log(`✅ Now using primary server: ${this.servers.primary}`);
    },
    
    // Check server health
    async checkServerHealth(serverUrl) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
            
            const response = await fetch(`${serverUrl}/api/live`, {
                signal: controller.signal,
                method: 'HEAD' // Fast health check
            });
            
            clearTimeout(timeoutId);
            return response.ok;
        } catch (error) {
            console.warn(`Server health check failed for ${serverUrl}:`, error.message);
            return false;
        }
    },
    
    // Periodically check if primary server is back online (if using fallback)
    async monitorPrimaryServer() {
        if (!this._serverStatus.primary && this._currentServer === this.servers.fallback) {
            const isPrimaryHealthy = await this.checkServerHealth(this.servers.primary);
            if (isPrimaryHealthy) {
                this.switchToPrimary();
            }
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
        // Remote source (fallback and updates)
        remote: {
            stations: 'https://pakrail.rise.com.pk/data/stations.json',
            trains: 'https://pakrail.rise.com.pk/data/trains.json',
            schedules: 'https://pakrail.rise.com.pk/data/schedules.json',
            version: 'https://pakrail.rise.com.pk/data/version.json'
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
            
            // Get remote version (always check)
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

// Enhanced fetch with automatic fallback
async function fetchWithFallback(url, options = {}) {
    try {
        // Add timeout to fetch
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response;
        
    } catch (error) {
        console.error(`❌ Request failed to ${url}:`, error.message);
        
        // If currently using primary server, try switching to fallback
        if (API_CONFIG._currentServer === API_CONFIG.servers.primary || 
            API_CONFIG._currentServer === null) {
            
            console.log('🔄 Attempting fallback server...');
            API_CONFIG.switchToFallback();
            
            // Retry with fallback server
            const fallbackUrl = url.replace(API_CONFIG.servers.primary, API_CONFIG.servers.fallback);
            
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);
                
                const fallbackResponse = await fetch(fallbackUrl, {
                    ...options,
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (!fallbackResponse.ok) {
                    throw new Error(`HTTP ${fallbackResponse.status}: ${fallbackResponse.statusText}`);
                }
                
                console.log('✅ Fallback server responded successfully');
                return fallbackResponse;
                
            } catch (fallbackError) {
                console.error('❌ Fallback server also failed:', fallbackError.message);
                throw new Error('Both primary and fallback servers are unavailable');
            }
        } else {
            // Already using fallback, can't retry
            throw error;
        }
    }
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
console.log('🔗 [CONFIG] Primary Server:', API_CONFIG.servers.primary);
console.log('🔗 [CONFIG] Fallback Server:', API_CONFIG.servers.fallback);
console.log('🔗 [CONFIG] Active Server:', API_CONFIG.getBaseURL());
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
console.log('🔄 [CONFIG] Server Redundancy: PRIMARY → FALLBACK (Automatic Switching)');
console.log('═══════════════════════════════════════════════════════════');

// Monitor primary server health every 5 minutes (if using fallback)
if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    setInterval(() => {
        API_CONFIG.monitorPrimaryServer();
    }, 5 * 60 * 1000); // 5 minutes
}