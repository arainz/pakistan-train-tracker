// Mobile-specific features for Pakistan Train Tracker
class MobileTrainTracker {
    constructor() {
        this.isCapacitor = false;
        this.isOnline = true;
        this.userLocation = null;
        this.watchId = null;
        this.init();
    }

    async init() {
        // Check if running in Capacitor (mobile app)
        if (window.Capacitor) {
            this.isCapacitor = true;
            console.log('🚂 Running as mobile app');
            
            // Import Capacitor plugins
            const { SplashScreen } = window.Capacitor.Plugins;
            const { StatusBar } = window.Capacitor.Plugins;
            const { Network } = window.Capacitor.Plugins;
            const { Geolocation } = window.Capacitor.Plugins;
            
            // Initialize mobile features
            await this.setupSplashScreen();
            await this.setupStatusBar();
            await this.setupNetworkMonitoring();
            await this.setupGeolocation();
            
        } else {
            console.log('🌐 Running as web app');
        }
        
        this.setupMobileUI();
    }

    async setupSplashScreen() {
        try {
            const { SplashScreen } = window.Capacitor.Plugins;
            // Hide splash screen after 2 seconds
            setTimeout(async () => {
                await SplashScreen.hide();
            }, 2000);
        } catch (error) {
            console.log('SplashScreen not available:', error);
        }
    }

    async setupStatusBar() {
        try {
            const { StatusBar } = window.Capacitor.Plugins;
            await StatusBar.setStyle({ style: 'light' });
            await StatusBar.setBackgroundColor({ color: '#2563EB' });
        } catch (error) {
            console.log('StatusBar not available:', error);
        }
    }

    async setupNetworkMonitoring() {
        try {
            const { Network } = window.Capacitor.Plugins;
            
            // Check initial network status
            const status = await Network.getStatus();
            this.isOnline = status.connected;
            
            // Listen for network changes
            Network.addListener('networkStatusChange', (status) => {
                console.log('Network status changed:', status);
                this.isOnline = status.connected;
                this.handleNetworkChange(status.connected);
            });
        } catch (error) {
            console.log('Network monitoring not available:', error);
        }
    }

    async setupGeolocation() {
        try {
            const { Geolocation } = window.Capacitor.Plugins;
            
            // Get current position
            const position = await Geolocation.getCurrentPosition({
                enableHighAccuracy: true,
                timeout: 10000
            });
            
            this.userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            
            console.log('📍 User location:', this.userLocation);
            this.showNearbyStations();
            
        } catch (error) {
            console.log('Geolocation not available:', error);
        }
    }

    setupMobileUI() {
        // Add mobile-specific CSS
        const style = document.createElement('style');
        style.textContent = `
            /* Mobile-specific styles */
            .mobile-only { display: block; }
            .web-only { display: none; }
            
            @media (min-width: 768px) {
                .mobile-only { display: none; }
                .web-only { display: block; }
            }
            
            /* Touch-friendly buttons */
            .train-card, button {
                min-height: 44px;
                touch-action: manipulation;
            }
            
            /* Mobile header */
            .mobile-header {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                z-index: 1000;
                background: #4CAF50;
                color: white;
                padding: 12px 20px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                min-height: 50px;
                backdrop-filter: blur(10px);
            }
            
            .mobile-content {
                margin-top: 50px !important;
                padding: 10px;
            }
            
            /* Ensure content doesn't hide behind mobile header */
            @media (max-width: 768px) {
                body.mobile-app .container {
                    margin-top: 50px !important;
                    padding-top: 10px !important;
                }
                
                body.mobile-app header {
                    display: none !important;
                }
                
                .mobile-header h1 {
                    font-size: 1.1em !important;
                    margin: 0 !important;
                }
            }
            
            /* Offline indicator */
            .offline-banner {
                position: fixed;
                top: 50px;
                left: 0;
                right: 0;
                background: #ff4444;
                color: white;
                text-align: center;
                padding: 8px;
                z-index: 999;
                display: none;
                font-size: 14px;
            }
            
            .offline-banner.show {
                display: block;
            }
        `;
        document.head.appendChild(style);
        
        // Add mobile header if in mobile app
        if (this.isCapacitor) {
            this.addMobileHeader();
            this.addOfflineBanner();
        }
    }

    addMobileHeader() {
        // Add mobile app class to body
        document.body.classList.add('mobile-app');
        
        const header = document.createElement('div');
        header.className = 'mobile-header mobile-only';
        header.innerHTML = `
            <div>
                <h1 style="margin: 0; font-size: 1.1em;">🚂 Pakistan Trains</h1>
            </div>
            <div>
                <span id="network-status" style="font-size: 0.9em;">
                    ${this.isOnline ? '🟢 Online' : '🔴 Offline'}
                </span>
            </div>
        `;
        document.body.insertBefore(header, document.body.firstChild);
        
        // Update container margin for mobile
        const container = document.querySelector('.container');
        if (container) {
            container.style.marginTop = '50px';
            container.style.paddingTop = '10px';
            container.classList.add('mobile-content');
        }
        
        // Hide original header in mobile app
        const originalHeader = document.querySelector('header');
        if (originalHeader) {
            originalHeader.style.display = 'none';
        }
    }

    addOfflineBanner() {
        const banner = document.createElement('div');
        banner.id = 'offline-banner';
        banner.className = 'offline-banner';
        banner.innerHTML = '⚠️ You are offline. Showing cached data.';
        document.body.insertBefore(banner, document.body.firstChild);
    }

    handleNetworkChange(isOnline) {
        this.isOnline = isOnline;
        
        // Update network status in header
        const statusElement = document.getElementById('network-status');
        if (statusElement) {
            statusElement.textContent = isOnline ? '🟢 Online' : '🔴 Offline';
        }
        
        // Show/hide offline banner
        const banner = document.getElementById('offline-banner');
        if (banner) {
            if (isOnline) {
                banner.classList.remove('show');
            } else {
                banner.classList.add('show');
            }
        }
        
        // Handle data loading
        if (isOnline) {
            // Refresh data when back online
            if (typeof fetchActiveTrains === 'function') {
                fetchActiveTrains();
            }
        } else {
            // Show cached data
            this.loadCachedData();
        }
    }

    showNearbyStations() {
        if (!this.userLocation) return;
        
        // Add nearby stations button
        const searchSection = document.querySelector('.search-section');
        if (searchSection && this.isCapacitor) {
            const nearbyBtn = document.createElement('button');
            nearbyBtn.innerHTML = '📍 Nearby Stations';
            nearbyBtn.onclick = () => this.findNearbyStations();
            nearbyBtn.style.cssText = `
                background: #48bb78;
                color: white;
                border: none;
                padding: 12px 20px;
                border-radius: 25px;
                margin-left: 10px;
                cursor: pointer;
            `;
            searchSection.appendChild(nearbyBtn);
        }
    }

    findNearbyStations() {
        // This would integrate with your existing station data
        console.log('🔍 Finding nearby stations...');
        alert(`Finding stations near your location:\nLat: ${this.userLocation.lat.toFixed(4)}\nLng: ${this.userLocation.lng.toFixed(4)}`);
    }

    loadCachedData() {
        // Load cached train data when offline
        const cached = localStorage.getItem('cachedTrainData');
        if (cached) {
            try {
                const data = JSON.parse(cached);
                console.log('📱 Loading cached data:', data.length, 'trains');
                // Update UI with cached data
                if (typeof displayActiveTrains === 'function') {
                    displayActiveTrains(data);
                }
            } catch (error) {
                console.error('Error loading cached data:', error);
            }
        }
    }

    cacheTrainData(trains) {
        // Cache train data for offline use
        try {
            localStorage.setItem('cachedTrainData', JSON.stringify(trains));
            localStorage.setItem('lastCacheUpdate', Date.now().toString());
        } catch (error) {
            console.error('Error caching data:', error);
        }
    }

    async showNotification(title, body) {
        if (this.isCapacitor) {
            try {
                const { LocalNotifications } = window.Capacitor.Plugins;
                await LocalNotifications.schedule({
                    notifications: [{
                        title: title,
                        body: body,
                        id: Date.now(),
                        schedule: { at: new Date() }
                    }]
                });
            } catch (error) {
                console.log('Notifications not available:', error);
            }
        }
    }
}

// Initialize mobile features when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.mobileTracker = new MobileTrainTracker();
});

// Override existing fetch functions to handle caching
if (typeof fetchActiveTrains === 'function') {
    const originalFetchActiveTrains = fetchActiveTrains;
    fetchActiveTrains = async function() {
        try {
            await originalFetchActiveTrains();
            // Cache the data after successful fetch
            if (window.mobileTracker && trainData && trainData.active) {
                window.mobileTracker.cacheTrainData(trainData.active);
            }
        } catch (error) {
            console.error('Error fetching trains:', error);
            // Load cached data on error
            if (window.mobileTracker) {
                window.mobileTracker.loadCachedData();
            }
        }
    };
}