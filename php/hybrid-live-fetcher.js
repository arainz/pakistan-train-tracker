/**
 * Hybrid live data fetcher - tries multiple methods to get real data
 * Falls back gracefully when live connections fail
 */

class HybridLiveFetcher {
    constructor() {
        this.liveTrains = [];
        this.lastUpdated = null;
        this.isConnected = false;
        this.fetchInterval = null;
        this.updateInterval = 45000; // 45 seconds
        this.attemptedMethods = [];
        
        console.log('🔄 Hybrid Live Fetcher initialized');
        this.init();
    }
    
    async init() {
        // Try multiple methods to get real data
        await this.tryAllMethods();
        
        // Set up periodic updates
        this.fetchInterval = setInterval(() => {
            this.tryAllMethods();
        }, this.updateInterval);
    }
    
    async tryAllMethods() {
        this.updateStatus('connecting', 'Trying multiple data sources...');
        
        // Method 1: Try PHP API endpoints directly
        if (await this.tryPHPAPI()) return;
        
        // Method 2: Try browser Socket.IO with CORS
        if (await this.tryBrowserSocketIO()) return;
        
        // Method 3: Try alternative APIs
        if (await this.tryAlternativeAPIs()) return;
        
        // Method 4: Enhanced realistic fallback
        this.useEnhancedFallback();
    }
    
    async tryPHPAPI() {
        try {
            console.log('🐘 Trying PHP API...');
            this.attemptedMethods.push('PHP API');
            
            const response = await fetch('./api.php?endpoint=live', {
                cache: 'no-cache'
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data && data.data.length > 3) {
                    console.log('✅ PHP API success:', data.data.length, 'trains');
                    this.processAPIData(data.data, 'PHP API');
                    return true;
                }
            }
        } catch (error) {
            console.log('❌ PHP API failed:', error.message);
        }
        return false;
    }
    
    async tryBrowserSocketIO() {
        try {
            console.log('🌐 Trying browser Socket.IO...');
            this.attemptedMethods.push('Browser Socket.IO');
            
            // Try with different CORS settings
            const socketUrl = 'https://socket.pakraillive.com/socket.io/';
            
            const sessionResponse = await fetch(`${socketUrl}?EIO=4&transport=polling&t=${Date.now()}`, {
                method: 'GET',
                mode: 'cors',
                credentials: 'omit',
                headers: {
                    'Accept': '*/*',
                    'User-Agent': 'Mozilla/5.0 (compatible; TrainTracker)'
                }
            });
            
            if (!sessionResponse.ok) {
                throw new Error(`HTTP ${sessionResponse.status}`);
            }
            
            const sessionText = await sessionResponse.text();
            const sessionMatch = sessionText.match(/\{"sid":"([^"]+)"/);
            
            if (sessionMatch) {
                console.log('🔑 Got Socket.IO session');
                // Continue with Socket.IO protocol...
                const sessionId = sessionMatch[1];
                
                // Send request
                await fetch(`${socketUrl}?EIO=4&transport=polling&sid=${sessionId}`, {
                    method: 'POST',
                    mode: 'cors',
                    body: '42["all-newtrains"]',
                    headers: {
                        'Content-Type': 'text/plain;charset=UTF-8'
                    }
                });
                
                // Poll for response
                for (let i = 0; i < 5; i++) {
                    await this.sleep(2000);
                    
                    const pollResponse = await fetch(`${socketUrl}?EIO=4&transport=polling&sid=${sessionId}&t=${Date.now()}`, {
                        mode: 'cors'
                    });
                    
                    if (pollResponse.ok) {
                        const pollText = await pollResponse.text();
                        const trainMatch = pollText.match(/42\["all-newtrains",(\{.*?\})\]/);
                        
                        if (trainMatch) {
                            const trainsData = JSON.parse(trainMatch[1]);
                            const processedTrains = this.processSocketIOData(trainsData);
                            
                            if (processedTrains.length > 10) {
                                console.log('✅ Socket.IO success:', processedTrains.length, 'trains');
                                this.liveTrains = processedTrains;
                                this.lastUpdated = new Date().toISOString();
                                this.isConnected = true;
                                this.updateStatus('connected');
                                this.updateUI();
                                this.dispatchUpdateEvent();
                                return true;
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.log('❌ Browser Socket.IO failed:', error.message);
        }
        return false;
    }
    
    async tryAlternativeAPIs() {
        const alternatives = [
            'https://api.trackyourtrains.com/live',
            'https://pakrailapi.com/v1/trains/live',
            'https://trackyourtrains.com/api/live-data'
        ];
        
        for (const url of alternatives) {
            try {
                console.log('🔍 Trying alternative API:', url);
                this.attemptedMethods.push(`Alternative: ${url}`);
                
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; TrainTracker)',
                        'Accept': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data && Array.isArray(data) && data.length > 5) {
                        console.log('✅ Alternative API success:', data.length, 'items');
                        this.processAPIData(data, `Alternative API`);
                        return true;
                    }
                }
            } catch (error) {
                console.log('❌ Alternative API failed:', error.message);
            }
        }
        return false;
    }
    
    useEnhancedFallback() {
        console.log('🎭 Using enhanced realistic fallback with multiple trains');
        this.attemptedMethods.push('Enhanced Fallback');
        
        // Create 15 realistic trains with Pakistani railway data
        const pakistaniTrains = [
            { name: 'Karachi Express', number: '1UP', route: 'KHI-LHE', lat: 31.5204, lng: 74.3587 },
            { name: 'Business Express', number: '2DN', route: 'LHE-KHI', lat: 24.8607, lng: 67.0011 },
            { name: 'Millat Express', number: '3UP', route: 'KHI-SGD', lat: 30.1575, lng: 71.5249 },
            { name: 'Pakistan Express', number: '4DN', route: 'LHE-KHI', lat: 29.3544, lng: 71.6911 },
            { name: 'Awam Express', number: '5UP', route: 'KHI-PSH', lat: 32.1877, lng: 74.1945 },
            { name: 'Green Line Express', number: '6DN', route: 'ISB-KHI', lat: 33.6844, lng: 73.0479 },
            { name: 'Khyber Mail', number: '7UP', route: 'KHI-PSH', lat: 34.0151, lng: 71.5249 },
            { name: 'Tezgam', number: '8DN', route: 'KHI-RWP', lat: 33.5651, lng: 73.0169 },
            { name: 'Allama Iqbal Express', number: '9UP', route: 'KHI-SKT', lat: 32.4945, lng: 74.5229 },
            { name: 'Shalimar Express', number: '10DN', route: 'KHI-LHE', lat: 31.5497, lng: 74.3436 },
            { name: 'Jaffar Express', number: '11UP', route: 'QTA-PSH', lat: 30.1798, lng: 66.9750 },
            { name: 'Bolan Mail', number: '12DN', route: 'QTA-KHI', lat: 27.7202, lng: 68.4572 },
            { name: 'Chiltan Express', number: '13UP', route: 'QTA-RWP', lat: 30.1798, lng: 66.9750 },
            { name: 'Sukkur Express', number: '14DN', route: 'KHI-JCB', lat: 27.7202, lng: 68.4572 },
            { name: 'Ravi Express', number: '15UP', route: 'LHE-KHI', lat: 31.5204, lng: 74.3587 }
        ];
        
        const trains = [];
        const currentTime = Date.now();
        
        pakistaniTrains.forEach((train, index) => {
            // Add realistic movement and variation
            const timeOffset = (currentTime % 3600000) / 3600000; // Hour cycle
            const trainOffset = index * 0.15;
            
            const latVariation = Math.sin(timeOffset + trainOffset) * 0.08;
            const lngVariation = Math.cos(timeOffset + trainOffset) * 0.08;
            
            trains.push({
                TrainId: `990${String(index + 1).padStart(3, '0')}`,
                InnerKey: `${index + 1}${String(Math.floor(Math.random() * 10))}001`,
                TrainName: train.name,
                TrainNumber: train.number,
                LocomotiveNumber: `ENG${String(index + 1).padStart(3, '0')}`,
                Latitude: parseFloat((train.lat + latVariation).toFixed(6)),
                Longitude: parseFloat((train.lng + lngVariation).toFixed(6)),
                Speed: Math.floor(Math.random() * 80) + 40, // 40-120 km/h
                LateBy: Math.floor(Math.random() * 61) - 15, // -15 to +45 minutes
                NextStation: this.getRandomStation(train.route),
                PrevStation: this.getRandomStation(train.route),
                Route: train.route,
                Status: this.getRandomStatus(),
                LastUpdated: new Date(currentTime - Math.random() * 300000).toISOString(),
                IsLive: false, // Mark as simulated
                Direction: train.number.includes('UP') ? 'Northbound' : 'Southbound',
                Platform: Math.floor(Math.random() * 8) + 1,
                EstimatedArrival: new Date(currentTime + Math.random() * 7200000).toLocaleTimeString()
            });
        });
        
        this.liveTrains = trains;
        this.lastUpdated = new Date().toISOString();
        this.isConnected = false;
        this.updateStatus('disconnected');
        this.updateUI();
        this.dispatchUpdateEvent();
        
        console.log(`🎭 Enhanced fallback: ${trains.length} simulated trains`);
    }
    
    getRandomStation(route) {
        const stations = {
            'KHI-LHE': ['Hyderabad', 'Sukkur', 'Multan', 'Sahiwal'],
            'LHE-KHI': ['Sahiwal', 'Multan', 'Sukkur', 'Hyderabad'],
            'KHI-SGD': ['Hyderabad', 'Sukkur', 'Jhang'],
            'KHI-PSH': ['Hyderabad', 'Multan', 'Lahore', 'Rawalpindi'],
            'ISB-KHI': ['Rawalpindi', 'Lahore', 'Multan', 'Sukkur'],
            'QTA-PSH': ['Sibi', 'Jacobabad', 'Multan', 'Lahore'],
            'QTA-KHI': ['Sibi', 'Jacobabad', 'Sukkur']
        };
        
        const routeStations = stations[route] || ['Next Station'];
        return routeStations[Math.floor(Math.random() * routeStations.length)];
    }
    
    getRandomStatus() {
        const statuses = ['On Time', 'Delayed', 'Running', 'Approaching', 'At Platform'];
        const weights = [35, 30, 20, 10, 5];
        
        const random = Math.random() * 100;
        let current = 0;
        
        for (let i = 0; i < statuses.length; i++) {
            current += weights[i];
            if (random <= current) {
                return statuses[i];
            }
        }
        return 'On Time';
    }
    
    processAPIData(data, source) {
        this.liveTrains = Array.isArray(data) ? data : [];
        this.lastUpdated = new Date().toISOString();
        this.isConnected = true;
        this.updateStatus('connected');
        this.updateUI();
        this.dispatchUpdateEvent();
        console.log(`✅ ${source} processed: ${this.liveTrains.length} trains`);
    }
    
    processSocketIOData(rawTrains) {
        const trains = [];
        for (const trainKey in rawTrains) {
            const trainData = rawTrains[trainKey];
            if (typeof trainData === 'object') {
                for (const innerKey of Object.keys(trainData)) {
                    const train = trainData[innerKey];
                    if (train && train.lat && train.lon) {
                        trains.push({
                            TrainId: trainKey,
                            InnerKey: innerKey,
                            TrainName: `Train ${trainKey}`,
                            TrainNumber: innerKey,
                            Latitude: parseFloat(train.lat),
                            Longitude: parseFloat(train.lon),
                            Speed: parseInt(train.sp) || 0,
                            LateBy: parseInt(train.late_by) || 0,
                            NextStation: train.next_stop || 'Unknown',
                            Status: train.st || 'Running',
                            LastUpdated: new Date(parseInt(train.last_updated) * 1000).toISOString(),
                            IsLive: true
                        });
                    }
                }
            }
        }
        return trains;
    }
    
    updateStatus(status, message) {
        const indicator = document.getElementById('statusIndicator');
        if (!indicator) return;
        
        indicator.className = `status-indicator status-${status}`;
        
        switch(status) {
            case 'connected':
                indicator.innerHTML = `✅ Live: ${this.liveTrains.length} trains`;
                break;
            case 'disconnected':
                indicator.innerHTML = `🎭 Simulation: ${this.liveTrains.length} trains`;
                break;
            case 'connecting':
                indicator.innerHTML = '🔄 ' + (message || 'Connecting...');
                break;
        }
    }
    
    updateUI() {
        // Update train count
        const totalTrainsEl = document.getElementById('totalTrains');
        if (totalTrainsEl) {
            totalTrainsEl.textContent = this.liveTrains.length;
        }
        
        // Update last update time
        const lastUpdateEl = document.getElementById('lastUpdate');
        if (lastUpdateEl && this.lastUpdated) {
            const time = new Date(this.lastUpdated);
            lastUpdateEl.textContent = time.toLocaleTimeString();
        }
        
        // Update trains grid
        this.updateTrainsGrid();
    }
    
    updateTrainsGrid() {
        const grid = document.getElementById('trainsGrid');
        if (!grid) return;
        
        if (this.liveTrains.length === 0) {
            grid.innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                    <p>Loading train data...</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        this.liveTrains.forEach(train => {
            const statusClass = (train.Status || '').toLowerCase().replace(/\s+/g, '-');
            const isLive = train.IsLive !== false;
            
            html += `
                <div class="train-card ${isLive ? 'live-train' : 'simulated-train'}" data-train-id="${train.InnerKey}">
                    <div class="train-header">
                        <h3>${train.TrainName || 'Train ' + train.TrainId}</h3>
                        <span class="train-number">${train.TrainNumber || train.InnerKey}</span>
                        ${!isLive ? '<span class="sim-badge">SIM</span>' : ''}
                    </div>
                    <div class="train-details">
                        <div class="detail-row">
                            <span class="label">Status:</span>
                            <span class="value status-${statusClass}">${train.Status || 'Unknown'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Speed:</span>
                            <span class="value">${train.Speed || 0} km/h</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Next Station:</span>
                            <span class="value">${train.NextStation || 'Unknown'}</span>
                        </div>
                        ${train.LateBy && train.LateBy !== 0 ? `
                            <div class="detail-row">
                                <span class="label">Delay:</span>
                                <span class="value ${train.LateBy > 0 ? 'delay' : 'early'}">${train.LateBy > 0 ? '+' : ''}${train.LateBy} min</span>
                            </div>
                        ` : ''}
                        <div class="detail-row">
                            <span class="label">Location:</span>
                            <span class="value">${(train.Latitude || 0).toFixed(4)}, ${(train.Longitude || 0).toFixed(4)}</span>
                        </div>
                        ${train.Platform ? `
                            <div class="detail-row">
                                <span class="label">Platform:</span>
                                <span class="value">${train.Platform}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });
        
        grid.innerHTML = html;
    }
    
    dispatchUpdateEvent() {
        const event = new CustomEvent('liveTrainsUpdated', {
            detail: {
                trains: this.liveTrains,
                count: this.liveTrains.length,
                lastUpdated: this.lastUpdated,
                isConnected: this.isConnected,
                methods: this.attemptedMethods
            }
        });
        
        window.dispatchEvent(event);
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    async refresh() {
        this.attemptedMethods = [];
        await this.tryAllMethods();
    }
    
    destroy() {
        if (this.fetchInterval) {
            clearInterval(this.fetchInterval);
            this.fetchInterval = null;
        }
        console.log('🔚 Hybrid fetcher destroyed');
    }
}

// Auto-initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔄 Initializing Hybrid Live Fetcher...');
    window.hybridLiveFetcher = new HybridLiveFetcher();
});

// Global refresh function
window.refreshData = async function() {
    const btn = document.getElementById('refreshBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '🔄 Refreshing...';
    }
    
    try {
        if (window.hybridLiveFetcher) {
            await window.hybridLiveFetcher.refresh();
        }
    } catch (error) {
        console.error('Refresh error:', error);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '🔄 Refresh';
        }
    }
};

// Add simulation styling
const style = document.createElement('style');
style.textContent = `
    .simulated-train {
        border-left-color: #ff9800 !important;
        opacity: 0.95;
    }
    
    .live-train {
        border-left-color: #4CAF50 !important;
    }
    
    .sim-badge {
        background: #ff9800;
        color: white;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 10px;
        font-weight: bold;
        margin-left: 8px;
    }
    
    .early {
        color: #4CAF50;
        font-weight: bold;
    }
    
    .delay {
        color: #ff9800;
        font-weight: bold;
    }
`;
document.head.appendChild(style);

console.log('🔄 Hybrid Live Fetcher script loaded');