/**
 * Simplified data loader for PHP version
 */

class SimpleDataLoader {
    constructor() {
        this.liveTrains = [];
        this.staticData = { trains: [], stations: [], trainStations: [] };
        this.lastUpdated = null;
        this.isConnected = false;
        
        console.log('🚀 Simple Data Loader initialized');
        this.init();
    }
    
    async init() {
        // Load static data first
        await this.loadStaticData();
        
        // Load live data
        await this.loadLiveData();
        
        // Update UI
        this.updateUI();
        
        // Set up periodic updates every 30 seconds
        setInterval(() => {
            this.loadLiveData();
        }, 30000);
    }
    
    async loadStaticData() {
        try {
            console.log('📊 Loading static data...');
            
            // Load trains
            const trainsResponse = await fetch('./api.php?endpoint=trains');
            const trainsData = await trainsResponse.json();
            if (trainsData.success) {
                this.staticData.trains = trainsData.data;
            }
            
            // Load stations
            const stationsResponse = await fetch('./api.php?endpoint=stations');
            const stationsData = await stationsResponse.json();
            if (stationsData.success) {
                this.staticData.stations = stationsData.data;
            }
            
            console.log(`✅ Loaded ${this.staticData.trains.length} trains, ${this.staticData.stations.length} stations`);
            
        } catch (error) {
            console.error('❌ Error loading static data:', error);
        }
    }
    
    async loadLiveData() {
        try {
            console.log('📡 Loading live data...');
            
            const response = await fetch('./api.php?endpoint=live');
            const data = await response.json();
            
            if (data.success) {
                this.liveTrains = data.data;
                this.lastUpdated = new Date().toISOString();
                this.isConnected = true;
                
                console.log(`✅ Loaded ${this.liveTrains.length} live trains`);
                
                // Update UI
                this.updateUI();
                
                // Dispatch event for other parts of the app
                this.dispatchUpdateEvent();
            } else {
                throw new Error(data.error || 'Failed to fetch live data');
            }
            
        } catch (error) {
            console.error('❌ Error loading live data:', error);
            this.isConnected = false;
            this.updateStatus('disconnected');
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
        
        // Update status
        this.updateStatus(this.isConnected ? 'connected' : 'disconnected');
        
        // Update trains grid
        this.updateTrainsGrid();
    }
    
    updateStatus(status) {
        const indicator = document.getElementById('statusIndicator');
        if (!indicator) return;
        
        indicator.className = `status-indicator status-${status}`;
        
        switch(status) {
            case 'connected':
                indicator.innerHTML = '✅ Live Data Connected';
                break;
            case 'disconnected':
                indicator.innerHTML = '❌ Offline Mode';
                break;
            case 'connecting':
                indicator.innerHTML = '🔄 Connecting...';
                break;
        }
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
            html += `
                <div class="train-card" data-train-id="${train.InnerKey}">
                    <div class="train-header">
                        <h3>${train.TrainName || 'Unknown Train'}</h3>
                        <span class="train-number">${train.TrainNumber || train.TrainId}</span>
                    </div>
                    <div class="train-details">
                        <div class="detail-row">
                            <span class="label">Status:</span>
                            <span class="value status-${train.Status?.toLowerCase().replace(' ', '-') || 'unknown'}">${train.Status || 'Unknown'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Speed:</span>
                            <span class="value">${train.Speed || 0} km/h</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Next Station:</span>
                            <span class="value">${train.NextStation || 'Unknown'}</span>
                        </div>
                        ${train.LateBy ? `
                            <div class="detail-row">
                                <span class="label">Delay:</span>
                                <span class="value delay">${train.LateBy} min</span>
                            </div>
                        ` : ''}
                        <div class="detail-row">
                            <span class="label">Location:</span>
                            <span class="value">${train.Latitude?.toFixed(4) || '--'}, ${train.Longitude?.toFixed(4) || '--'}</span>
                        </div>
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
                isConnected: this.isConnected
            }
        });
        
        window.dispatchEvent(event);
    }
    
    // Public methods for search and other features
    searchTrains(query) {
        if (!query) return this.staticData.trains;
        
        const lowerQuery = query.toLowerCase();
        return this.staticData.trains.filter(train =>
            train.TrainName?.toLowerCase().includes(lowerQuery) ||
            train.TrainNumber?.toString().includes(lowerQuery)
        );
    }
    
    async refreshData() {
        this.updateStatus('connecting');
        await this.loadLiveData();
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('🌐 Initializing Simple Data Loader...');
    window.simpleDataLoader = new SimpleDataLoader();
});

// Add some basic styles
const style = document.createElement('style');
style.textContent = `
    .train-card {
        background: white;
        border-radius: 8px;
        padding: 16px;
        margin: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        border-left: 4px solid #4CAF50;
    }
    
    .train-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        border-bottom: 1px solid #eee;
        padding-bottom: 8px;
    }
    
    .train-header h3 {
        margin: 0;
        color: #333;
        font-size: 18px;
    }
    
    .train-number {
        background: #4CAF50;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: bold;
        font-size: 14px;
    }
    
    .detail-row {
        display: flex;
        justify-content: space-between;
        margin: 6px 0;
        font-size: 14px;
    }
    
    .detail-row .label {
        color: #666;
        font-weight: 500;
    }
    
    .detail-row .value {
        color: #333;
        font-weight: 400;
    }
    
    .status-on-time, .status-on {
        color: #4CAF50;
        font-weight: bold;
    }
    
    .status-delayed {
        color: #ff9800;
        font-weight: bold;
    }
    
    .delay {
        color: #ff9800;
        font-weight: bold;
    }
    
    .trains-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 16px;
        padding: 16px;
    }
    
    .loading {
        text-align: center;
        padding: 40px;
        color: #666;
    }
    
    .spinner {
        border: 4px solid #f3f3f3;
        border-top: 4px solid #4CAF50;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
        margin: 0 auto 16px;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

console.log('📦 Simple loader script loaded');