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

console.log('🔧 API Config loaded:', {
    isMobile: window.Capacitor && window.Capacitor.isNativePlatform(),
    baseURL: API_CONFIG.getBaseURL(),
    socketURL: API_CONFIG.getSocketURL()
});