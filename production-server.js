const express = require('express');
const axios = require('axios');
const cors = require('cors');
const cron = require('node-cron');
const io = require('socket.io-client');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Data storage
let data = {
  stations: [],
  trains: [],
  trainStations: [],
  liveTrains: [],
  lastUpdated: null
};

// Base URLs
const DATA_BASE_URL = 'https://trackyourtrains.com/data';
const SOCKET_URL = 'https://socket.pakraillive.com';

// Fetch live train data directly - removed, will use WebSocket only

// Fetch static data from JSON endpoints
async function fetchStaticData() {
  try {
    console.log('Fetching static data from trackyourtrains.com...');
    
    // Fetch stations data
    const stationsResponse = await axios.get(`${DATA_BASE_URL}/StationsData.json?v=2025-06-06`);
    if (stationsResponse.data && stationsResponse.data.Response) {
      data.stations = Array.isArray(stationsResponse.data.Response) ? stationsResponse.data.Response : [];
    } else {
      data.stations = Array.isArray(stationsResponse.data) ? stationsResponse.data : [];
    }
    console.log(`Loaded ${data.stations.length} stations`);
    
    // Fetch trains data
    const trainsResponse = await axios.get(`${DATA_BASE_URL}/Trains.json?v=2025-06-06`);
    if (trainsResponse.data && trainsResponse.data.Response) {
      data.trains = Array.isArray(trainsResponse.data.Response) ? trainsResponse.data.Response : [];
    } else {
      data.trains = Array.isArray(trainsResponse.data) ? trainsResponse.data : [];
    }
    console.log(`Loaded ${data.trains.length} trains`);
    
    // Fetch train-stations mapping (schedules)
    const trainStationsResponse = await axios.get(`${DATA_BASE_URL}/TrainStations.json?v=2025-06-06`);
    if (trainStationsResponse.data && trainStationsResponse.data.Response) {
      data.trainStations = Array.isArray(trainStationsResponse.data.Response) ? trainStationsResponse.data.Response : [];
    } else {
      data.trainStations = Array.isArray(trainStationsResponse.data) ? trainStationsResponse.data : [];
    }
    console.log(`Loaded schedules for ${data.trainStations.length} trains`);
    
    data.lastUpdated = new Date().toISOString();
    
  } catch (error) {
    console.error('Error fetching static data:', error.message);
    // Initialize with empty arrays to prevent errors
    data.stations = data.stations || [];
    data.trains = data.trains || [];
    data.trainStations = data.trainStations || [];
  }
}

// Connect to WebSocket for live train data
function connectWebSocket() {
  console.log('Connecting to WebSocket for live train data...');
  
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
    console.log('Socket ID:', socket.id);
    
    // Request all trains data - this is the correct event name
    socket.emit('all-newtrains');
  });
  
  // Main event for receiving all trains (same format as delta)
  socket.on('all-newtrains', (trains) => {
    console.log('📊 Received all-newtrains event');
    console.log('🔍 Raw train keys received:', Object.keys(trains || {}));
    
    // Log first few trains to see structure
    const trainKeys = Object.keys(trains || {});
    if (trainKeys.length > 0) {
      console.log('🔍 Sample train data:');
      trainKeys.slice(0, 3).forEach(key => {
        console.log(`   ${key}:`, JSON.stringify(trains[key], null, 2));
      });
    }
    
    if (trains && typeof trains === 'object') {
      // Initialize liveTrains map if it doesn't exist
      if (!data.liveTrainsMap) {
        data.liveTrainsMap = {};
      }
      
      // Process all trains (same format as delta)
      for (const trainKey in trains) {
        const trainData = trains[trainKey];
        
        // Handle multiple inner keys per train (multiple instances)
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
            
            // Store using innerKey as unique identifier for multiple instances
            data.liveTrainsMap[innerKey] = formattedTrain;
          }
        }
      }
      
      // Convert map to array
      data.liveTrains = Object.values(data.liveTrainsMap);
      data.lastUpdated = new Date().toISOString();
      console.log(`✅ Initial load: ${data.liveTrains.length} live trains`);
    }
  });
  
  // Delta updates for train positions
  socket.on('all-newtrains-delta', (delta) => {
    if (delta && typeof delta === 'object') {
      // Initialize liveTrains map if it doesn't exist
      if (!data.liveTrainsMap) {
        data.liveTrainsMap = {};
      }
      
      // The data comes as an object with train IDs as keys
      for (const trainKey in delta) {
        const trainData = delta[trainKey];
        
        // Handle multiple inner keys per train (multiple instances)
        for (const innerKey of Object.keys(trainData)) {
          if (innerKey && trainData[innerKey]) {
            const train = trainData[innerKey];
            
            // Parse and format the train data
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
            
            // Store using innerKey as unique identifier for multiple instances
            data.liveTrainsMap[innerKey] = formattedTrain;
          }
        }
      }
      
      // Convert map to array for API response
      data.liveTrains = Object.values(data.liveTrainsMap);
      data.lastUpdated = new Date().toISOString();
      
      console.log(`✅ Total live trains: ${data.liveTrains.length}`);
      if (data.liveTrains.length > 0) {
        console.log('Latest update:', data.liveTrains[data.liveTrains.length - 1].TrainName);
      }
    }
  });
  
  socket.on('disconnect', (reason) => {
    console.log('❌ WebSocket disconnected:', reason);
    // Try to reconnect
    setTimeout(() => {
      console.log('Attempting to reconnect...');
      socket.connect();
    }, 5000);
  });
  
  socket.on('connect_error', (error) => {
    console.error('WebSocket connection error:', error.message);
  });
  
  socket.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
  
  return socket;
}

function updateLiveTrains(delta) {
  // Apply delta updates to existing live trains data
  if (Array.isArray(delta)) {
    delta.forEach(update => {
      const index = data.liveTrains.findIndex(t => t.TrainId === update.TrainId);
      if (index !== -1) {
        data.liveTrains[index] = { ...data.liveTrains[index], ...update };
      } else {
        data.liveTrains.push(update);
      }
    });
    data.lastUpdated = new Date().toISOString();
  }
}

// API Endpoints

// Get all trains
app.get('/api/trains', (req, res) => {
  res.json({
    success: true,
    data: data.trains,
    count: data.trains.length,
    lastUpdated: data.lastUpdated
  });
});

// Get all stations
app.get('/api/stations', (req, res) => {
  res.json({
    success: true,
    data: data.stations,
    count: data.stations.length,
    lastUpdated: data.lastUpdated
  });
});

// Get live trains
app.get('/api/live', (req, res) => {
  // Combine live data with train information
  const enrichedLiveTrains = data.liveTrains.map(liveTrain => {
    const trainInfo = data.trains.find(t => t.TrainId === liveTrain.TrainId);
    const schedule = data.trainStations.find(ts => ts.TrainId === liveTrain.TrainId);
    
    return {
      ...liveTrain,
      trainName: trainInfo ? trainInfo.TrainName : 'Unknown',
      trainNameUrdu: trainInfo ? trainInfo.TrainNameUrdu : '',
      trainNumber: trainInfo ? trainInfo.TrainNumber : liveTrain.TrainNumber,
      stations: schedule ? (schedule.stations || schedule.Stations || []) : []
    };
  });
  
  res.json({
    success: true,
    data: enrichedLiveTrains,
    count: enrichedLiveTrains.length,
    lastUpdated: data.lastUpdated
  });
});

// Get train schedules
app.get('/api/schedule', (req, res) => {
  // Combine train schedules with train information
  const schedules = data.trainStations.map(schedule => {
    const trainInfo = data.trains.find(t => t.TrainId === schedule.TrainId);
    
    return {
      trainId: schedule.TrainId,
      trainName: trainInfo ? trainInfo.TrainName : 'Unknown',
      trainNameUrdu: trainInfo ? trainInfo.TrainNameUrdu : '',
      trainNumber: trainInfo ? trainInfo.TrainNumber : 'N/A',
      stations: (schedule.stations || schedule.Stations || [])
    };
  });
  
  res.json({
    success: true,
    data: schedules,
    count: schedules.length,
    lastUpdated: data.lastUpdated
  });
});

// Get specific train details
app.get('/api/train/:identifier', (req, res) => {
  const { identifier } = req.params;
  
  // Find train by ID or Number (handle both string and number)
  let train = data.trains.find(t => 
    t.TrainId == identifier || 
    String(t.TrainNumber) === String(identifier) ||
    String(t.TrainNumber) === String(identifier).toUpperCase()
  );
  
  if (!train) {
    return res.status(404).json({
      success: false,
      error: 'Train not found'
    });
  }
  
  // Get schedule for this train
  const schedule = data.trainStations.find(ts => ts.TrainId === train.TrainId);
  
  // Get live status if available
  const liveStatus = data.liveTrains.find(lt => lt.TrainId === train.TrainId);
  
  // Station data is already included in TrainStations.json
  const enrichedStations = schedule ? (schedule.stations || schedule.Stations || []) : [];
  
  res.json({
    success: true,
    data: {
      ...train,
      schedule: enrichedStations,
      liveStatus: liveStatus || null
    }
  });
});

// Search trains
app.get('/api/search', (req, res) => {
  const { query } = req.query;
  
  if (!query) {
    return res.status(400).json({
      success: false,
      error: 'Search query is required'
    });
  }
  
  const searchTerm = query.toLowerCase();
  
  const results = data.trains.filter(train => 
    String(train.TrainNumber).toLowerCase().includes(searchTerm) ||
    train.TrainName.toLowerCase().includes(searchTerm) ||
    (train.TrainNameUR || train.TrainNameUrdu || '').includes(query)
  );
  
  res.json({
    success: true,
    data: results,
    count: results.length
  });
});

// Search stations
app.get('/api/stations/search', (req, res) => {
  const { query } = req.query;
  
  if (!query) {
    return res.status(400).json({
      success: false,
      error: 'Search query is required'
    });
  }
  
  const searchTerm = query.toLowerCase();
  
  const results = data.stations.filter(station => 
    station.StationName.toLowerCase().includes(searchTerm) ||
    station.StationNameUrdu.includes(query) ||
    station.StationId.toLowerCase().includes(searchTerm)
  );
  
  res.json({
    success: true,
    data: results,
    count: results.length
  });
});

// Get trains between two stations
app.get('/api/trains/between', (req, res) => {
  const { from, to } = req.query;
  
  if (!from || !to) {
    return res.status(400).json({
      success: false,
      error: 'Both from and to station IDs are required'
    });
  }
  
  const results = data.trainStations.filter(schedule => {
    const stations = schedule.stations || schedule.Stations || [];
    const hasFrom = stations.some(s => s.StationId === from);
    const hasTo = stations.some(s => s.StationId === to);
    
    if (hasFrom && hasTo) {
      const fromIndex = stations.findIndex(s => s.StationId === from);
      const toIndex = stations.findIndex(s => s.StationId === to);
      return fromIndex < toIndex; // Ensure correct direction
    }
    
    return false;
  }).map(schedule => {
    const trainInfo = data.trains.find(t => t.TrainId === schedule.TrainId);
    return {
      ...trainInfo,
      fromStation: stations.find(s => s.StationId === from),
      toStation: stations.find(s => s.StationId === to)
    };
  });
  
  res.json({
    success: true,
    data: results,
    count: results.length
  });
});

// Refresh data
app.get('/api/refresh', async (req, res) => {
  await fetchStaticData();
  
  res.json({
    success: true,
    message: 'Data refreshed successfully',
    lastUpdated: data.lastUpdated
  });
});

// Live insights/statistics endpoint matching trackyourtrains.com logic
app.get('/api/insights', (req, res) => {
  const now = new Date();
  const cutoffTime = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago
  
  // Calculate insights based on live train data with Pakistan timezone consideration
  const activeTrains = data.liveTrains.filter(train => {
    const lastUpdate = new Date(train.LastUpdated);
    return train.IsLive && lastUpdate >= cutoffTime;
  });
  
  const movingTrains = activeTrains.filter(train => train.Speed > 5);
  const stoppedTrains = activeTrains.filter(train => train.Speed <= 5);
  const onTimeTrains = activeTrains.filter(train => Math.abs(train.LateBy) <= 15);
  const delayedTrains = activeTrains.filter(train => train.LateBy > 15);
  const earlyTrains = activeTrains.filter(train => train.LateBy < -15);
  
  // Speed categories
  const highSpeedTrains = activeTrains.filter(train => train.Speed > 80);
  const mediumSpeedTrains = activeTrains.filter(train => train.Speed > 30 && train.Speed <= 80);
  const lowSpeedTrains = activeTrains.filter(train => train.Speed > 5 && train.Speed <= 30);
  
  const insights = {
    totalActiveTrains: activeTrains.length,
    trainsOnTheMove: movingTrains.length,
    trainsStopped: stoppedTrains.length,
    onTimeTrains: onTimeTrains.length,
    delayedTrains: delayedTrains.length,
    earlyTrains: earlyTrains.length,
    highSpeedTrains: highSpeedTrains.length,
    mediumSpeedTrains: mediumSpeedTrains.length,
    lowSpeedTrains: lowSpeedTrains.length,
    averageDelay: activeTrains.length > 0 ? 
      Math.round(activeTrains.reduce((sum, train) => sum + Math.abs(train.LateBy), 0) / activeTrains.length) : 0,
    averageSpeed: activeTrains.length > 0 ? 
      Math.round(activeTrains.reduce((sum, train) => sum + train.Speed, 0) / activeTrains.length) : 0,
    lastUpdated: data.lastUpdated,
    dataFreshness: now.toISOString()
  };
  
  res.json({
    success: true,
    data: insights
  });
});

// Initialize data and start server
async function initialize() {
  console.log('Initializing Pakistan Train Tracker...');
  
  // Fetch initial static data
  await fetchStaticData();
  
  // Connect to WebSocket for live updates
  const socket = connectWebSocket();
  
  // Schedule periodic refresh of static data (every hour)
  cron.schedule('0 * * * *', () => {
    console.log('Running scheduled static data refresh...');
    fetchStaticData();
  });
  
  // Start server
  app.listen(PORT, () => {
    console.log(`\n✅ Train Tracker Server running on http://localhost:${PORT}`);
    console.log('\n📊 Available API Endpoints:');
    console.log('  GET /api/trains - Get all trains');
    console.log('  GET /api/stations - Get all stations');
    console.log('  GET /api/live - Get live train status');
    console.log('  GET /api/schedule - Get train schedules');
    console.log('  GET /api/train/:id - Get specific train details');
    console.log('  GET /api/search?query=xxx - Search trains');
    console.log('  GET /api/stations/search?query=xxx - Search stations');
    console.log('  GET /api/trains/between?from=XXX&to=YYY - Find trains between stations');
    console.log('  GET /api/refresh - Manually refresh data');
    console.log('\n🔄 WebSocket connected to:', SOCKET_URL);
  });
}

// Start the application
initialize();