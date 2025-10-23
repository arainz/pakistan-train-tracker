const express = require('express');
const axios = require('axios');
const cors = require('cors');
const cron = require('node-cron');
const io = require('socket.io-client');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// Use safe ports that don't require root privileges
const PREFERRED_PORTS = [3001, 8080, 3000, 8000, 5000, 4000];
let PORT = process.env.PORT || 3001;

// Always use the specified PORT or fall back to 3001
if (!process.env.PORT) {
  PORT = 3001; // Default to 3001 which should work
}

app.use(cors({
  origin: ['http://pakrail.aimworld.org', 'https://pakrail.aimworld.org', 'http://localhost:*'],
  credentials: true
}));

app.use(express.json());

// Serve static files from multiple possible locations
const possiblePublicDirs = ['./public', '../public', '/home/pakrail.aimworld.org/public_html/public'];
let publicDir = './public';

for (const dir of possiblePublicDirs) {
  if (fs.existsSync(dir)) {
    publicDir = dir;
    break;
  }
}

app.use(express.static(publicDir));
console.log(`📂 Serving static files from: ${publicDir}`);

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
    // Use v2.x compatible settings
    transports: ['websocket', 'polling'],
    path: '/socket.io/',
    forceNew: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    // Add v2.x compatibility
    upgrade: true,
    rememberUpgrade: true
  });
  
  socket.on('connect', () => {
    console.log('✅ WebSocket connected successfully');
    console.log('🆔 Socket ID:', socket.id);
    
    // Request all trains data - try both v2 and v3 formats
    socket.emit('all-newtrains');
  });
  
  // Handle connection errors more gracefully
  socket.on('connect_error', (error) => {
    console.error('❌ WebSocket connection error:', error.message);
    
    // If version mismatch, try alternative connection
    if (error.message.includes('v2.x') || error.message.includes('v3.x')) {
      console.log('🔄 Trying alternative Socket.IO connection...');
      setTimeout(() => {
        tryAlternativeConnection();
      }, 5000);
    }
  });
  
  // Rest of your socket event handlers...
  socket.on('all-newtrains', (trains) => {
    console.log('📊 Received all-newtrains event');
    console.log('🔍 Raw train keys received:', Object.keys(trains || {}).length);
    
    if (trains && typeof trains === 'object') {
      // Process trains data
      processTrainsData(trains);
    }
  });
  
  socket.on('all-newtrains-delta', (delta) => {
    if (delta && typeof delta === 'object') {
      processTrainsDelta(delta);
    }
  });
  
  return socket;
}

function processTrainsData(trains) {
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

function processTrainsDelta(delta) {
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

// Alternative connection method using HTTP polling
async function tryAlternativeConnection() {
  console.log('🔄 Trying HTTP-based live data fetching...');
  
  // Set up interval to fetch data via HTTP
  setInterval(async () => {
    try {
      const response = await axios.get('https://pakraillive.com/api/live-trains', {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; TrainTracker)',
          'Accept': 'application/json'
        }
      });
      
      if (response.data && Array.isArray(response.data)) {
        console.log(`📡 HTTP fetch: ${response.data.length} trains`);
        data.liveTrains = response.data;
        data.lastUpdated = new Date().toISOString();
      }
    } catch (error) {
      console.error('❌ HTTP fetch failed:', error.message);
    }
  }, 30000); // Every 30 seconds
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

// Serve static files
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, publicDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Pakistan Train Tracker</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; text-align: center; }
          .container { max-width: 600px; margin: 0 auto; }
          .status { background: #e8f5e8; padding: 20px; border-radius: 10px; margin: 20px 0; }
          .api-links { text-align: left; background: #f5f5f5; padding: 20px; border-radius: 10px; }
          .api-links a { display: block; margin: 10px 0; color: #0066cc; text-decoration: none; }
          .api-links a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🚂 Pakistan Train Tracker</h1>
          <div class="status">
            <h2>✅ Server Running Successfully</h2>
            <p>Live Trains: ${data.liveTrains.length}</p>
            <p>Total Trains: ${data.trains.length}</p>
            <p>Stations: ${data.stations.length}</p>
            <p>Last Updated: ${data.lastUpdated || 'Loading...'}</p>
          </div>
          
          <div class="api-links">
            <h3>Available API Endpoints:</h3>
            <a href="/api/live">📊 Live Train Data</a>
            <a href="/api/trains">🚂 All Trains</a>
            <a href="/api/stations">🚉 All Stations</a>
            <a href="/api/schedule">📅 Train Schedules</a>
            <a href="/health">❤️ Health Check</a>
          </div>
          
          <p style="margin-top: 30px; color: #666;">
            Server running on port ${PORT}
          </p>
        </div>
        
        <script>
          // Auto-refresh every 30 seconds
          setTimeout(() => window.location.reload(), 30000);
        </script>
      </body>
      </html>
    `);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    port: PORT,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    liveTrains: data.liveTrains.length,
    totalTrains: data.trains.length,
    stations: data.stations.length,
    lastUpdated: data.lastUpdated,
    urls: [
      `http://pakrail.aimworld.org:${PORT}`,
      `https://pakrail.aimworld.org:${PORT}`,
      `http://pakrail.aimworld.org:${PORT}/api/live`
    ]
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
    console.log(`🔌 Attempting to use port: ${PORT}`);
    
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
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🌟 Server running on port ${PORT}`);
      console.log(`🔗 Local access: http://localhost:${PORT}`);
      console.log(`🔗 External access: http://pakrail.aimworld.org:${PORT}`);
      console.log(`🔗 HTTPS access: https://pakrail.aimworld.org:${PORT}`);
      console.log(`📊 Health check: http://pakrail.aimworld.org:${PORT}/health`);
      console.log(`🚂 API endpoints: http://pakrail.aimworld.org:${PORT}/api/live`);
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