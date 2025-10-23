const express = require('express');
const axios = require('axios');
const cors = require('cors');
const cron = require('node-cron');
const io = require('socket.io-client');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Data storage
let data = {
  stations: [],
  trains: [],
  trainStations: [],
  liveTrains: [],
  liveTrainsMap: {},
  lastUpdated: null
};

// Base URLs
const DATA_BASE_URL = 'https://trackyourtrains.com/data';
const SOCKET_URL = 'https://socket.pakraillive.com';

// Fetch static data from JSON endpoints
async function fetchStaticData() {
  try {
    console.log('📊 Fetching static data from trackyourtrains.com...');
    
    // Fetch stations data
    const stationsResponse = await axios.get(`${DATA_BASE_URL}/StationsData.json?v=2025-06-06`);
    if (stationsResponse.data && stationsResponse.data.Response) {
      data.stations = Array.isArray(stationsResponse.data.Response) ? stationsResponse.data.Response : [];
    } else {
      data.stations = Array.isArray(stationsResponse.data) ? stationsResponse.data : [];
    }
    console.log(`✅ Loaded ${data.stations.length} stations`);
    
    // Fetch trains data
    const trainsResponse = await axios.get(`${DATA_BASE_URL}/Trains.json?v=2025-06-06`);
    if (trainsResponse.data && trainsResponse.data.Response) {
      data.trains = Array.isArray(trainsResponse.data.Response) ? trainsResponse.data.Response : [];
    } else {
      data.trains = Array.isArray(trainsResponse.data) ? trainsResponse.data : [];
    }
    console.log(`✅ Loaded ${data.trains.length} trains`);
    
    // Fetch train-stations mapping (schedules)
    const trainStationsResponse = await axios.get(`${DATA_BASE_URL}/TrainStations.json?v=2025-06-06`);
    if (trainStationsResponse.data && trainStationsResponse.data.Response) {
      data.trainStations = Array.isArray(trainStationsResponse.data.Response) ? trainStationsResponse.data.Response : [];
    } else {
      data.trainStations = Array.isArray(trainStationsResponse.data) ? trainStationsResponse.data : [];
    }
    console.log(`✅ Loaded schedules for ${data.trainStations.length} trains`);
    
    data.lastUpdated = new Date().toISOString();
    
  } catch (error) {
    console.error('❌ Error fetching static data:', error.message);
    // Initialize with empty arrays to prevent errors
    data.stations = data.stations || [];
    data.trains = data.trains || [];
    data.trainStations = data.trainStations || [];
  }
}

// Connect to WebSocket for live train data
function connectWebSocket() {
  console.log('🔌 Connecting to WebSocket for live train data...');
  
  const socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    path: '/socket.io/',
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000
  });
  
  socket.on('connect', () => {
    console.log('✅ WebSocket connected successfully');
    console.log('🆔 Socket ID:', socket.id);
    
    // Request all trains data
    socket.emit('all-newtrains');
  });
  
  // Main event for receiving all trains
  socket.on('all-newtrains', (trains) => {
    console.log('📊 Received all-newtrains event');
    console.log('🔍 Raw train keys received:', Object.keys(trains || {}).length);
    
    if (trains && typeof trains === 'object') {
      // Initialize liveTrains map if it doesn't exist
      if (!data.liveTrainsMap) {
        data.liveTrainsMap = {};
      }
      
      // Process all trains
      for (const trainKey in trains) {
        const trainData = trains[trainKey];
        
        // Handle multiple inner keys per train
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
            
            // Try to find matching train in static data
            const staticTrain = data.trains.find(t => 
              String(t.TrainId) === String(trainKey.replace('9900', '')) ||
              String(t.TrainId) === String(innerKey.split('0')[0])
            );
            
            if (staticTrain) {
              formattedTrain.TrainName = staticTrain.TrainName;
              formattedTrain.TrainNumber = staticTrain.TrainNumber;
              formattedTrain.TrainNameUrdu = staticTrain.TrainNameUR;
            }
            
            // Store using innerKey as unique identifier
            data.liveTrainsMap[innerKey] = formattedTrain;
          }
        }
      }
      
      // Convert map to array
      data.liveTrains = Object.values(data.liveTrainsMap);
      data.lastUpdated = new Date().toISOString();
      console.log(`✅ Total live trains: ${data.liveTrains.length}`);
    }
  });
  
  // Delta updates for train positions
  socket.on('all-newtrains-delta', (delta) => {
    if (delta && typeof delta === 'object') {
      // Initialize liveTrains map if it doesn't exist
      if (!data.liveTrainsMap) {
        data.liveTrainsMap = {};
      }
      
      let updatedCount = 0;
      
      // Process delta updates
      for (const trainKey in delta) {
        const trainData = delta[trainKey];
        
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
            
            // Try to find matching train in static data
            const staticTrain = data.trains.find(t => 
              String(t.TrainId) === String(trainKey.replace('9900', '')) ||
              String(t.TrainId) === String(innerKey.split('0')[0])
            );
            
            if (staticTrain) {
              formattedTrain.TrainName = staticTrain.TrainName;
              formattedTrain.TrainNumber = staticTrain.TrainNumber;
              formattedTrain.TrainNameUrdu = staticTrain.TrainNameUR;
            }
            
            data.liveTrainsMap[innerKey] = formattedTrain;
            updatedCount++;
          }
        }
      }
      
      // Convert map to array
      data.liveTrains = Object.values(data.liveTrainsMap);
      data.lastUpdated = new Date().toISOString();
      
      if (updatedCount > 0) {
        console.log(`🔄 Delta update: ${updatedCount} trains updated, Total: ${data.liveTrains.length}`);
      }
    }
  });
  
  socket.on('disconnect', () => {
    console.log('❌ WebSocket disconnected');
  });
  
  socket.on('connect_error', (error) => {
    console.error('❌ WebSocket connection error:', error.message);
  });
  
  socket.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
  
  // Return socket for cleanup if needed
  return socket;
}

// API Routes
app.get('/api/live', (req, res) => {
  res.json({
    success: true,
    data: data.liveTrains,
    count: data.liveTrains.length,
    lastUpdated: data.lastUpdated
  });
});

app.get('/api/trains', (req, res) => {
  res.json({
    success: true,
    data: data.trains,
    count: data.trains.length
  });
});

app.get('/api/stations', (req, res) => {
  res.json({
    success: true,
    data: data.stations,
    count: data.stations.length
  });
});

app.get('/api/schedule', (req, res) => {
  res.json({
    success: true,
    data: data.trainStations,
    count: data.trainStations.length
  });
});

app.get('/api/train/:id', (req, res) => {
  const trainId = req.params.id;
  
  const train = data.trains.find(t => 
    t.TrainNumber == trainId || 
    t.InnerKey == trainId ||
    t.TrainName?.toLowerCase().includes(trainId.toLowerCase())
  );
  
  if (!train) {
    return res.status(404).json({
      success: false,
      error: 'Train not found'
    });
  }
  
  const schedule = data.trainStations.filter(station => 
    station.TrainNumber == train.TrainNumber
  );
  
  res.json({
    success: true,
    data: {
      train,
      schedule
    }
  });
});

app.get('/api/search', (req, res) => {
  const query = req.query.query?.toLowerCase();
  
  if (!query) {
    return res.status(400).json({
      success: false,
      error: 'Query parameter required'
    });
  }
  
  const results = data.trains.filter(train =>
    train.TrainName?.toLowerCase().includes(query) ||
    train.TrainNumber?.toString().includes(query)
  );
  
  res.json({
    success: true,
    data: results,
    count: results.length
  });
});

// Serve static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/train.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'train.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    liveTrains: data.liveTrains.length,
    lastUpdated: data.lastUpdated
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Initialize app
async function initializeApp() {
  try {
    console.log('🚀 Initializing Pakistan Train Tracker...');
    
    // Load static data first
    await fetchStaticData();
    
    // Connect to WebSocket for live data
    connectWebSocket();
    
    // Schedule periodic static data refresh (every hour)
    cron.schedule('0 * * * *', () => {
      console.log('🔄 Refreshing static data...');
      fetchStaticData();
    });
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🌟 Server running on port ${PORT}`);
      console.log(`🔗 Access at: http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🚂 API endpoints: http://localhost:${PORT}/api/live`);
    });
    
  } catch (error) {
    console.error('❌ Failed to initialize app:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📴 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Initialize the application
initializeApp();