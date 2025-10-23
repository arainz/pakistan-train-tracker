/**
 * JavaScript-based live data fetcher for Pakistan Train Tracker
 * This runs in the browser and can fetch real-time data using Socket.IO polling
 */

class LiveDataFetcher {
    constructor() {
        this.liveTrains = [];
        this.lastUpdated = null;
        this.isConnected = false;
        this.fetchInterval = null;
        this.socketUrl = 'https://socket.pakraillive.com';
        this.updateInterval = 30000; // 30 seconds
        
        // Static data cache
        this.staticData = {
            trains: [],
            stations: [],
            trainStations: []
        };
        
        this.init();
    }
    
    async init() {
        console.log('🚀 Initializing Live Data Fetcher...');
        
        // Load static data first
        await this.loadStaticData();
        
        // Start fetching live data
        this.startLiveDataFetching();
        
        // Set up periodic updates
        this.fetchInterval = setInterval(() => {
            this.fetchLiveData();
        }, this.updateInterval);
    }
    
    async loadStaticData() {
        try {
            console.log('📊 Loading static data...');
            
            const baseUrl = 'https://trackyourtrains.com/data';
            
            // Fetch trains data
            const trainsResponse = await fetch(`${baseUrl}/Trains.json?v=2025-06-06`);
            const trainsData = await trainsResponse.json();
            this.staticData.trains = trainsData.Response || trainsData || [];
            
            // Fetch stations data  
            const stationsResponse = await fetch(`${baseUrl}/StationsData.json?v=2025-06-06`);
            const stationsData = await stationsResponse.json();
            this.staticData.stations = stationsData.Response || stationsData || [];
            
            // Fetch train stations data
            const trainStationsResponse = await fetch(`${baseUrl}/TrainStations.json?v=2025-06-06`);
            const trainStationsData = await trainStationsResponse.json();
            this.staticData.trainStations = trainStationsData.Response || trainStationsData || [];
            
            console.log(`✅ Loaded ${this.staticData.trains.length} trains, ${this.staticData.stations.length} stations`);
        } catch (error) {
            console.error('❌ Error loading static data:', error);
        }
    }
    
    async startLiveDataFetching() {
        console.log('🔄 Starting live data fetching...');
        await this.fetchLiveData();
    }
    
    async fetchLiveData() {
        try {
            console.log('📡 Fetching live train data via Socket.IO polling...');
            
            // Step 1: Establish Socket.IO session
            const sessionResponse = await fetch(`${this.socketUrl}/socket.io/?EIO=4&transport=polling`, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': '*/*'
                }
            });
            
            if (!sessionResponse.ok) {
                throw new Error(`Session request failed: ${sessionResponse.status}`);
            }
            
            const sessionText = await sessionResponse.text();
            const sessionData = sessionText.substring(sessionText.indexOf('{'));
            const session = JSON.parse(sessionData);
            const sid = session.sid;
            
            if (!sid) throw new Error('No session ID received');
            console.log('🔑 Got session ID:', sid.substring(0, 8) + '...');
            
            // Step 2: Request all trains data
            const requestPayload = '42["all-newtrains"]';
            await fetch(`${this.socketUrl}/socket.io/?EIO=4&transport=polling&sid=${sid}`, {
                method: 'POST',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Content-Type': 'text/plain;charset=UTF-8',
                    'Accept': '*/*'
                },
                body: requestPayload
            });
            
            // Step 3: Poll for response with timeout
            let attempts = 0;
            const maxAttempts = 5;
            let trainsData = null;
            
            while (attempts < maxAttempts && !trainsData) {
                await this.sleep(2000); // Wait 2 seconds between attempts
                
                const responseResp = await fetch(`${this.socketUrl}/socket.io/?EIO=4&transport=polling&sid=${sid}`, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': '*/*'
                    }
                });
                
                if (responseResp.ok) {
                    const responseText = await responseResp.text();
                    
                    // Look for all-newtrains response
                    const regex = /42\["all-newtrains",(\{.*?\})\]/;
                    const match = responseText.match(regex);
                    
                    if (match) {
                        try {
                            trainsData = JSON.parse(match[1]);
                            break;
                        } catch (parseError) {
                            console.warn('⚠️ Failed to parse trains data:', parseError.message);
                        }
                    }
                }
                
                attempts++;
                console.log(`🔄 Polling attempt ${attempts}/${maxAttempts}...`);
            }
            
            if (trainsData) {
                this.processLiveTrainsData(trainsData);
                this.isConnected = true;
                console.log(`✅ Successfully fetched ${this.liveTrains.length} live trains`);
            } else {
                throw new Error('No trains data received after polling');
            }
            
        } catch (error) {
            console.error('❌ Error fetching live data:', error.message);
            this.isConnected = false;
            
            // Use fallback data if available
            if (this.liveTrains.length === 0) {
                this.useFallbackData();
            }
        }
    }
    
    processLiveTrainsData(trainsData) {
        const processedTrains = [];
        
        for (const trainKey in trainsData) {
            const trainData = trainsData[trainKey];
            
            for (const innerKey of Object.keys(trainData)) {
                if (innerKey && trainData[innerKey]) {
                    const train = trainData[innerKey];
                    
                    const formattedTrain = {
                        TrainId: trainKey,
                        InnerKey: innerKey,
                        LocomotiveNumber: train.locomitiveNo,
                        Latitude: parseFloat(train.lat),
                        Longitude: parseFloat(train.lon),
                        Speed: parseInt(train.sp) || 0,
                        LateBy: parseInt(train.late_by) || 0,
                        NextStationId: train.next_station,
                        NextStation: train.next_stop,
                        PrevStationId: train.prev_station,
                        NextStationETA: train.NextStationETA,
                        LastUpdated: new Date(parseInt(train.last_updated) * 1000).toISOString(),
                        Status: train.st,
                        Icon: train.icon,
                        IsLive: true
                    };
                    
                    // Try to match with static train data
                    const staticTrain = this.staticData.trains.find(t => 
                        String(t.TrainId) === String(trainKey.replace('9900', '')) ||
                        String(t.TrainId) === String(innerKey.split('0')[0])
                    );
                    
                    if (staticTrain) {
                        formattedTrain.TrainName = staticTrain.TrainName;
                        formattedTrain.TrainNumber = staticTrain.TrainNumber;
                        formattedTrain.TrainNameUrdu = staticTrain.TrainNameUR;
                    }
                    
                    processedTrains.push(formattedTrain);
                }
            }
        }
        
        this.liveTrains = processedTrains;
        this.lastUpdated = new Date().toISOString();
        
        // Dispatch event for other parts of the app
        this.dispatchUpdateEvent();
    }
    
    useFallbackData() {
        console.log('⚠️ Using fallback data - live data unavailable');
        
        this.liveTrains = [
            {
                TrainId: '9900001',
                InnerKey: '11001',
                TrainName: 'Karachi Express',
                TrainNumber: '1UP',
                LocomotiveNumber: 'ENG001',
                Latitude: 31.5204,
                Longitude: 74.3587,
                Speed: 85,
                LateBy: 0,
                NextStation: 'Faisalabad',
                Status: 'On Time',
                LastUpdated: new Date().toISOString(),
                IsLive: false
            },
            {
                TrainId: '9900002', 
                InnerKey: '22001',
                TrainName: 'Business Express',
                TrainNumber: '2DN',
                LocomotiveNumber: 'ENG002',
                Latitude: 33.6844,
                Longitude: 73.0479,
                Speed: 0,
                LateBy: 15,
                NextStation: 'Rawalpindi',
                Status: 'Delayed',
                LastUpdated: new Date().toISOString(),
                IsLive: false
            }
        ];
        
        this.lastUpdated = new Date().toISOString();
        this.dispatchUpdateEvent();
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
    
    // Public methods
    getLiveTrains() {
        return {
            success: true,
            data: this.liveTrains,
            count: this.liveTrains.length,
            lastUpdated: this.lastUpdated,
            isConnected: this.isConnected
        };
    }
    
    getStaticData(type) {
        return {
            success: true,
            data: this.staticData[type] || [],
            count: (this.staticData[type] || []).length
        };
    }
    
    searchTrains(query) {
        const results = this.staticData.trains.filter(train =>
            train.TrainName?.toLowerCase().includes(query.toLowerCase()) ||
            train.TrainNumber?.toString().includes(query)
        );
        
        return {
            success: true,
            data: results,
            count: results.length
        };
    }
    
    getTrainDetails(trainId) {
        const train = this.staticData.trains.find(t => 
            t.TrainNumber == trainId || 
            t.InnerKey == trainId ||
            t.TrainName?.toLowerCase().includes(trainId.toLowerCase())
        );
        
        if (!train) {
            return {
                success: false,
                error: 'Train not found'
            };
        }
        
        const schedule = this.staticData.trainStations.filter(station => 
            station.TrainNumber == train.TrainNumber
        );
        
        return {
            success: true,
            data: {
                train,
                schedule
            }
        };
    }
    
    destroy() {
        if (this.fetchInterval) {
            clearInterval(this.fetchInterval);
            this.fetchInterval = null;
        }
        console.log('🔚 Live data fetcher destroyed');
    }
}

// Global instance
window.liveDataFetcher = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    if (!window.liveDataFetcher) {
        window.liveDataFetcher = new LiveDataFetcher();
    }
});

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LiveDataFetcher;
}