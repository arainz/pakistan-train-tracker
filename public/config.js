// API Configuration
const API_CONFIG = {
    // Auto-detect if running in Capacitor mobile app
    getBaseURL() {
        // Check if running in Capacitor (mobile app)
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            // Mobile app - use production server
            return 'https://pakistan-train-tracker.onrender.com';
        } else {
            // Web browser - use relative URLs (current domain)
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
            return 'https://pakistan-train-tracker.onrender.com';
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

// Helper function for Socket.io connection
function getSocketURL() {
    return API_CONFIG.getSocketURL();
}

console.log('🔧 API Config loaded:', {
    isMobile: window.Capacitor && window.Capacitor.isNativePlatform(),
    baseURL: API_CONFIG.getBaseURL(),
    socketURL: API_CONFIG.getSocketURL()
});