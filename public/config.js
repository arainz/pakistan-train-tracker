// API Configuration
const API_CONFIG = {
    // Primary and fallback servers
    servers: {
        primary: 'https://pakistan-train-tracker-174840179894.us-central1.run.app', // Google Cloud Run (FREE trial - 180 days)
        fallback: 'http://138.2.91.18:3000', // Oracle Cloud (FREE, Always Free Tier)
        backup: 'https://confused-eel-pakrail-7ab69761.koyeb.app', // Koyeb (FREE, always-on)
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

    // WebSocket configuration (uses currently active server)
    getSocketURL() {
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            return this._currentServer || this.servers.primary;
        } else {
            return window.location.origin;
        }
    },

    // Static data configuration (Hybrid approach - local first, remote fallback)
    staticData: {
        // Local bundled files (primary - fast, offline)
        local: {
            stations: '/data/stations.json',
            trains: '/data/trains.json',
            schedules: '/data/schedules.json',
            version: '/data/version.json'
        },
        // Remote source (fallback - uses active server)
        // URLs are built dynamically using getRemoteUrl()
        endpoints: {
            stations: '/api/stations',
            trains: '/api/trains',
            schedules: '/api/schedule',
            version: '/api/version'
        }
    },

    // Get remote URL using currently active server
    getRemoteUrl(endpoint) {
        const baseUrl = this._currentServer || this.servers.primary;
        const endpointPath = this.staticData.endpoints[endpoint];
        return `${baseUrl}${endpointPath}`;
    },

    // Helper to fetch static data with hybrid approach
    async fetchStaticData(type, forceRemote = false) {
        const startTime = Date.now();
        const isMobileApp = window.Capacitor && window.Capacitor.isNativePlatform();

        console.log(`📦 [DATA SOURCE] Loading ${type} data...`);
        console.log(`📦 [DATA SOURCE] Force remote: ${forceRemote}`);
        console.log(`📦 [DATA SOURCE] Platform: ${isMobileApp ? 'MOBILE APP' : 'WEB BROWSER'}`);
        console.log(`📦 [DATA SOURCE] Origin: ${window.location.origin}`);

        // ALWAYS try local first (unless explicitly forcing remote)
        // For mobile app, NEVER fallback to remote to ensure bundled data is used
        if (!forceRemote) {
            try {
                const localPath = this.staticData.local[type];
                // Add cache-busting parameter to prevent iOS WebView caching
                const cacheBuster = `?v=${Date.now()}`;
                const urlWithCacheBuster = `${localPath}${cacheBuster}`;

                console.log(`📂 [DATA SOURCE] Attempting local: ${localPath}`);
                console.log(`📂 [DATA SOURCE] Full URL: ${window.location.origin}${urlWithCacheBuster}`);

                const response = await fetch(urlWithCacheBuster, {
                    cache: 'no-store',  // Prevent caching
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    }
                });
                console.log(`📂 [DATA SOURCE] Local response status: ${response.status} ${response.statusText}`);

                if (response.ok) {
                    const data = await response.json();
                    const loadTime = Date.now() - startTime;
                    const dataSize = JSON.stringify(data).length;
                    const records = Array.isArray(data) ? data.length : (data.Response?.length || 'N/A');

                    console.log(`✅ [DATA SOURCE] SUCCESS - Loaded ${type} from LOCAL files`);
                    console.log(`✅ [DATA SOURCE] Source: ${window.location.origin}${localPath}`);
                    console.log(`✅ [DATA SOURCE] Load time: ${loadTime}ms`);
                    console.log(`✅ [DATA SOURCE] Data size: ${(dataSize / 1024).toFixed(2)} KB`);
                    console.log(`✅ [DATA SOURCE] Records: ${records}`);

                    return data;
                } else {
                    console.warn(`⚠️ [DATA SOURCE] Local ${type} returned ${response.status}`);
                }
            } catch (error) {
                console.warn(`⚠️ [DATA SOURCE] Local ${type} failed:`, error.message);
                console.warn(`⚠️ [DATA SOURCE] Will try remote fallback...`);
            }
        }

        // Fallback to remote or if forced
        try {
            // Build URL using currently active server
            const remoteUrl = this.getRemoteUrl(type);
            console.log(`🌐 [DATA SOURCE] Attempting remote: ${remoteUrl}`);
            console.log(`🌐 [DATA SOURCE] Active server: ${this._currentServer || this.servers.primary}`);
            console.log(`🌐 [DATA SOURCE] Fetching from server...`);

            const response = await fetch(remoteUrl, {
                timeout: 10000
            });
            console.log(`🌐 [DATA SOURCE] Remote response status: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            const loadTime = Date.now() - startTime;
            const dataSize = JSON.stringify(data).length;
            const records = Array.isArray(data) ? data.length : (data.Response?.length || 'N/A');

            console.log(`✅ [DATA SOURCE] SUCCESS - Loaded ${type} from REMOTE server`);
            console.log(`✅ [DATA SOURCE] Source: ${remoteUrl}`);
            console.log(`✅ [DATA SOURCE] Load time: ${loadTime}ms`);
            console.log(`✅ [DATA SOURCE] Data size: ${(dataSize / 1024).toFixed(2)} KB`);
            console.log(`✅ [DATA SOURCE] Records: ${records}`);
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
            console.log('🔍 Checking for data updates...');
            
            // Get local version
            const localVersionData = await this.fetchStaticData('version', false);
            const localVersion = localVersionData?.version || '0';
            
            // Get remote version (always check remote for updates)
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
            return {
                hasUpdate: false,
                localVersion: '0',
                remoteVersion: '0'
            };
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
console.log('🌐 [CONFIG] Remote Data Endpoints:');
console.log('   Stations:', API_CONFIG.staticData.endpoints.stations);
console.log('   Trains:', API_CONFIG.staticData.endpoints.trains);
console.log('   Schedules:', API_CONFIG.staticData.endpoints.schedules);
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