/**
 * Browser-based live data fetcher - runs client-side to bypass server restrictions
 * This replicates the exact Socket.IO connection from your Node.js server
 */

class BrowserLiveFetcher {
    constructor() {
        this.socketUrl = 'https://socket.pakraillive.com/socket.io/';
        this.liveTrains = [];
        this.lastUpdated = null;
        this.isConnected = false;
        this.fetchInterval = null;
        this.updateInterval = 30000; // 30 seconds
        
        console.log('🌐 Browser Live Fetcher initialized');
        this.init();
    }
    
    async init() {
        // Try to fetch real data immediately
        await this.fetchRealLiveData();
        
        // Set up periodic updates
        this.fetchInterval = setInterval(() => {
            this.fetchRealLiveData();
        }, this.updateInterval);
    }
    
    async fetchRealLiveData() {
        try {
            console.log('🔄 Attempting real Socket.IO connection...');
            this.updateStatus('connecting', 'Connecting to live data...');
            
            // Step 1: Establish Socket.IO session
            const sessionResponse = await fetch(`${this.socketUrl}?EIO=4&transport=polling&t=${Date.now()}`, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': '*/*',
                    'Referer': 'https://pakraillive.com/',
                    'Origin': 'https://pakraillive.com'
                },
                mode: 'cors'
            });
            
            if (!sessionResponse.ok) {
                throw new Error(`Session request failed: ${sessionResponse.status}`);
            }
            
            const sessionText = await sessionResponse.text();
            console.log('📡 Session response length:', sessionText.length);
            
            // Parse session ID from response like "97:0{"sid":"abc123",...}"
            const sessionMatch = sessionText.match(/\{"sid":"([^"]+)"/);
            if (!sessionMatch) {
                throw new Error('No session ID found in response');
            }
            
            const sessionId = sessionMatch[1];
            console.log('🔑 Session ID:', sessionId.substring(0, 8) + '...');
            
            // Step 2: Send request for all trains
            const requestPayload = '42["all-newtrains"]';
            const postResponse = await fetch(`${this.socketUrl}?EIO=4&transport=polling&sid=${sessionId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=UTF-8',
                    'Accept': '*/*',
                    'Referer': 'https://pakraillive.com/',
                    'Origin': 'https://pakraillive.com'
                },
                body: requestPayload,
                mode: 'cors'
            });
            
            if (!postResponse.ok) {
                throw new Error(`POST request failed: ${postResponse.status}`);
            }
            
            console.log('📤 Sent all-newtrains request');
            
            // Step 3: Poll for response with multiple attempts
            let trainsData = null;
            const maxPolls = 15;
            
            for (let poll = 1; poll <= maxPolls && !trainsData; poll++) {
                await this.sleep(1000); // Wait 1 second between polls
                
                try {
                    const pollResponse = await fetch(`${this.socketUrl}?EIO=4&transport=polling&sid=${sessionId}&t=${Date.now()}`, {
                        method: 'GET',
                        headers: {
                            'Accept': '*/*',
                            'Referer': 'https://pakraillive.com/',
                            'Origin': 'https://pakraillive.com'
                        },
                        mode: 'cors'
                    });
                    
                    if (pollResponse.ok) {
                        const pollText = await pollResponse.text();
                        console.log(`🔍 Poll ${poll} response length:`, pollText.length);
                        
                        // Look for all-newtrains response: 42["all-newtrains",{...}]
                        const trainMatch = pollText.match(/42\["all-newtrains",(\{.*?\})\]/);
                        if (trainMatch) {
                            try {
                                trainsData = JSON.parse(trainMatch[1]);
                                console.log('🎯 Found trains data! Keys:', Object.keys(trainsData).length);
                                break;
                            } catch (parseError) {
                                console.warn('⚠️ Parse error:', parseError.message);
                            }
                        }
                        
                        // Log sample for debugging
                        if (pollText.length > 10) {
                            console.log(`📄 Poll ${poll} sample:`, pollText.substring(0, 150));
                        }
                    }
                } catch (pollError) {
                    console.warn(`⚠️ Poll ${poll} error:`, pollError.message);
                }
            }
            
            if (trainsData) {
                this.processRealTrainsData(trainsData);
                this.isConnected = true;
                this.updateStatus('connected');
                console.log(`✅ Successfully fetched ${this.liveTrains.length} real trains`);
            } else {
                throw new Error('No trains data received after polling');
            }
            
        } catch (error) {
            console.error('❌ Real data fetch failed:', error.message);
            this.isConnected = false;
            this.updateStatus('disconnected');
            
            // Use fallback if no data yet
            if (this.liveTrains.length === 0) {
                this.useFallbackData();
            }
        }
    }
    
    processRealTrainsData(rawTrains) {
        const processedTrains = [];
        
        for (const trainKey in rawTrains) {
            const trainData = rawTrains[trainKey];
            
            if (typeof trainData === 'object') {
                for (const innerKey of Object.keys(trainData)) {
                    const train = trainData[innerKey];
                    
                    if (train && train.lat && train.lon) {
                        const formattedTrain = {
                            TrainId: trainKey,
                            InnerKey: innerKey,
                            LocomotiveNumber: train.locomitiveNo || '',
                            Latitude: parseFloat(train.lat),
                            Longitude: parseFloat(train.lon),
                            Speed: parseInt(train.sp) || 0,
                            LateBy: parseInt(train.late_by) || 0,
                            NextStationId: train.next_station || '',
                            NextStation: train.next_stop || 'Unknown',
                            PrevStationId: train.prev_station || '',
                            NextStationETA: train.NextStationETA || '',
                            LastUpdated: new Date(parseInt(train.last_updated) * 1000).toISOString(),
                            Status: train.st || 'Unknown',
                            Icon: train.icon || '',
                            IsLive: true,
                            TrainName: `Train ${trainKey}`,
                            TrainNumber: innerKey.toString()
                        };
                        
                        processedTrains.push(formattedTrain);
                    }
                }
            }
        }
        
        this.liveTrains = processedTrains;
        this.lastUpdated = new Date().toISOString();
        
        // Update UI and dispatch event
        this.updateUI();
        this.dispatchUpdateEvent();
    }
    
    useFallbackData() {
        console.log('⚠️ Using fallback - live connection failed');
        
        this.liveTrains = [
            {
                TrainId: 'OFFLINE',
                InnerKey: '00000',
                TrainName: 'Live Data Unavailable',
                TrainNumber: 'OFF',
                LocomotiveNumber: 'N/A',
                Latitude: 31.5204,
                Longitude: 74.3587,
                Speed: 0,
                LateBy: 0,
                NextStation: 'Check Connection',
                Status: 'Offline',
                LastUpdated: new Date().toISOString(),
                IsLive: false
            }
        ];
        
        this.lastUpdated = new Date().toISOString();
        this.updateUI();
        this.dispatchUpdateEvent();
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
                indicator.innerHTML = '❌ Live Data Failed';
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
                    <p>Connecting to live data...</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        this.liveTrains.forEach(train => {
            const statusClass = train.Status ? train.Status.toLowerCase().replace(/\s+/g, '-') : 'unknown';
            
            html += `
                <div class="train-card" data-train-id="${train.InnerKey}">
                    <div class="train-header">
                        <h3>${train.TrainName || 'Train ' + train.TrainId}</h3>
                        <span class="train-number">${train.TrainNumber || train.InnerKey}</span>
                    </div>
                    <div class="train-details">
                        <div class="detail-row">
                            <span class="label">Status:</span>
                            <span class="value status-${statusClass}">${train.Status}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Speed:</span>
                            <span class="value">${train.Speed} km/h</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Next Station:</span>
                            <span class="value">${train.NextStation}</span>
                        </div>
                        ${train.LateBy !== 0 ? `
                            <div class="detail-row">
                                <span class="label">Delay:</span>
                                <span class="value ${train.LateBy > 0 ? 'delay' : 'early'}">${train.LateBy > 0 ? '+' : ''}${train.LateBy} min</span>
                            </div>
                        ` : ''}
                        <div class="detail-row">
                            <span class="label">Location:</span>
                            <span class="value">${train.Latitude.toFixed(4)}, ${train.Longitude.toFixed(4)}</span>
                        </div>
                        ${train.LocomotiveNumber ? `
                            <div class="detail-row">
                                <span class="label">Locomotive:</span>
                                <span class="value">${train.LocomotiveNumber}</span>
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
                isConnected: this.isConnected
            }
        });
        
        window.dispatchEvent(event);
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // Public method for manual refresh
    async refresh() {
        await this.fetchRealLiveData();
    }
    
    destroy() {
        if (this.fetchInterval) {
            clearInterval(this.fetchInterval);
            this.fetchInterval = null;
        }
        console.log('🔚 Browser live fetcher destroyed');
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Browser Live Fetcher...');
    window.browserLiveFetcher = new BrowserLiveFetcher();
});

// Override refresh function
window.refreshData = async function() {
    const btn = document.getElementById('refreshBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '🔄 Refreshing...';
    }
    
    try {
        if (window.browserLiveFetcher) {
            await window.browserLiveFetcher.refresh();
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

console.log('🌐 Browser Live Fetcher script loaded');