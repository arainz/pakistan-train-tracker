const express = require('express');
const axios = require('axios');
const cors = require('cors');
const cron = require('node-cron');
const io = require('socket.io-client');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configure CORS to allow credentials
// Support multiple origins for development and production
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:8080',
  'http://138.2.91.18:3000',
  'https://pakistan-train-tracker-174840179894.us-central1.run.app',
  'https://confused-eel-pakrail-7ab69761.koyeb.app'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like curl requests or mobile apps)
    if (!origin || allowedOrigins.includes(origin) || process.env.CORS_ORIGIN === '*') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Simple cookie parser middleware
app.use((req, _, next) => {
  const cookies = {};
  if (req.headers.cookie) {
    req.headers.cookie.split(';').forEach(cookie => {
      const [key, val] = cookie.trim().split('=');
      cookies[key] = val;
    });
  }
  req.cookies = cookies;
  next();
});

// =====================================================
// ADMIN PANEL AUTHENTICATION
// =====================================================
// Default credentials - CHANGE THESE IN PRODUCTION!
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'abdulnasir';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Arainz@898';

// Simple authentication middleware for admin panel
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  const sessionCookie = req.cookies.adminSession;

  // Check session cookie first
  if (sessionCookie) {
    try {
      const credentials = Buffer.from(sessionCookie, 'base64').toString();
      const [username, password] = credentials.split(':');

      if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        return next();
      }
    } catch (e) {
      // Invalid cookie, continue to check auth header
    }
  }

  // Check if authorization header exists
  if (!auth) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Please provide credentials' });
  }

  // Parse Basic Auth credentials
  try {
    const credentials = Buffer.from(auth.split(' ')[1], 'base64').toString();
    const [username, password] = credentials.split(':');

    // Validate credentials
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      next();
    } else {
      return res.status(401).json({ success: false, message: 'Unauthorized: Invalid credentials' });
    }
  } catch (e) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Invalid auth header' });
  }
}

// Login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    // Create a simple token (in production, use JWT)
    const token = Buffer.from(`${username}:${password}`).toString('base64');

    // Set cookie for session
    res.cookie('adminSession', token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/'
    });

    res.json({
      success: true,
      token: token,
      message: 'Login successful'
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }
});

// Apply authentication to admin panel
app.get('/admin-data-manager.html', (req, res) => {
  const auth = req.headers.authorization;
  const sessionCookie = req.cookies.adminSession;
  const token = req.query.token; // Check for token in query string (from login redirect)

  // Check if valid session cookie exists
  if (sessionCookie) {
    try {
      const credentials = Buffer.from(sessionCookie, 'base64').toString();
      const [username, password] = credentials.split(':');

      if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        return res.sendFile('public/admin-data-manager.html', { root: __dirname });
      }
    } catch (e) {
      // Invalid cookie
    }
  }

  // Check if token is passed in query string (post-login redirect)
  if (token) {
    try {
      const credentials = Buffer.from(token, 'base64').toString();
      const [username, password] = credentials.split(':');

      if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        // Set the cookie for future requests
        res.cookie('adminSession', token, {
          httpOnly: true,
          maxAge: 24 * 60 * 60 * 1000,
          path: '/'
        });
        return res.sendFile('public/admin-data-manager.html', { root: __dirname });
      }
    } catch (e) {
      // Invalid token
    }
  }

  if (!auth) {
    // No authorization header, serve login page
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Admin Panel Login</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .login-container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            width: 100%;
            max-width: 400px;
          }
          .login-container h1 {
            text-align: center;
            color: #333;
            margin-bottom: 30px;
            font-size: 28px;
          }
          .form-group {
            margin-bottom: 20px;
          }
          .form-group label {
            display: block;
            margin-bottom: 8px;
            color: #555;
            font-weight: 500;
          }
          .form-group input {
            width: 100%;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 14px;
            transition: border-color 0.3s;
          }
          .form-group input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 5px rgba(102, 126, 234, 0.3);
          }
          .btn {
            width: 100%;
            padding: 12px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 5px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
          }
          .btn:hover {
            transform: translateY(-2px);
          }
          .message {
            margin-top: 15px;
            padding: 12px;
            border-radius: 5px;
            text-align: center;
            display: none;
          }
          .message.error {
            background: #fee;
            color: #c33;
            display: none;
          }
          .message.success {
            background: #efe;
            color: #3c3;
            display: none;
          }
        </style>
      </head>
      <body>
        <div class="login-container">
          <h1>🔐 Admin Panel</h1>
          <form id="loginForm">
            <div class="form-group">
              <label for="username">Username</label>
              <input type="text" id="username" name="username" required autofocus>
            </div>
            <div class="form-group">
              <label for="password">Password</label>
              <input type="password" id="password" name="password" required>
            </div>
            <button type="submit" class="btn">Login</button>
            <div id="message" class="message"></div>
          </form>
        </div>

        <script>
          document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const messageDiv = document.getElementById('message');

            try {
              const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
                credentials: 'include'
              });

              const data = await response.json();

              if (data.success) {
                // Store token in localStorage
                localStorage.setItem('adminToken', data.token);
                // Redirect to admin panel with token in query string
                window.location.href = '/admin-data-manager.html?token=' + encodeURIComponent(data.token);
              } else {
                messageDiv.textContent = data.message;
                messageDiv.className = 'message error';
                messageDiv.style.display = 'block';
              }
            } catch (error) {
              messageDiv.textContent = 'Connection error: ' + error.message;
              messageDiv.className = 'message error';
              messageDiv.style.display = 'block';
            }
          });
        </script>
      </body>
      </html>
    `);
  }

  // Check if valid credentials in header
  try {
    const credentials = Buffer.from(auth.split(' ')[1], 'base64').toString();
    const [username, password] = credentials.split(':');

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      return res.sendFile('public/admin-data-manager.html', { root: __dirname });
    }
  } catch (e) {
    // Invalid auth header
  }

  // Invalid or missing credentials
  res.status(401).set('WWW-Authenticate', 'Basic realm="Admin Panel"').send('Unauthorized');
});

// Test login page (for debugging)
app.get('/login-test', (_, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Admin Panel Login Test</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; margin-bottom: 30px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; color: #555; font-weight: 500; }
        input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box; }
        button { width: 100%; padding: 12px; background: #667eea; color: white; border: none; border-radius: 4px; font-size: 16px; font-weight: 600; cursor: pointer; margin-top: 10px; }
        button:hover { background: #764ba2; }
        .result { margin-top: 20px; padding: 15px; border-radius: 4px; }
        .result.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .result.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        pre { background: #f4f4f4; padding: 10px; border-radius: 4px; overflow-x: auto; }
        .step { margin-top: 15px; padding: 10px; background: #f9f9f9; border-left: 3px solid #667eea; }
        .success-text { color: green; font-weight: bold; }
        .error-text { color: red; font-weight: bold; }
        a { color: #667eea; text-decoration: none; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🔐 Admin Panel Login Test</h1>
        <form id="loginForm">
          <div class="form-group">
            <label>Username:</label>
            <input type="text" id="username" value="admin" required>
          </div>
          <div class="form-group">
            <label>Password:</label>
            <input type="password" id="password" value="admin123" required>
          </div>
          <button type="submit">Login & Test Access</button>
        </form>
        <div id="result"></div>
      </div>

      <script>
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const resultDiv = document.getElementById('result');
          resultDiv.innerHTML = '<div class="step">🔄 Step 1: Logging in...</div>';

          const username = document.getElementById('username').value;
          const password = document.getElementById('password').value;

          try {
            // Step 1: Login
            const loginRes = await fetch('/api/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, password })
            });

            const loginData = await loginRes.json();

            if (!loginData.success) {
              resultDiv.innerHTML += '<div class="result error"><strong>❌ Login failed:</strong><pre>' + JSON.stringify(loginData, null, 2) + '</pre></div>';
              return;
            }

            resultDiv.innerHTML += '<div class="step"><span class="success-text">✅ Login successful!</span><pre>' + JSON.stringify(loginData, null, 2) + '</pre></div>';

            // Store token
            localStorage.setItem('adminToken', loginData.token);

            // Step 2: Try to access admin panel
            resultDiv.innerHTML += '<div class="step">🔄 Step 2: Accessing admin panel with token...</div>';
            const adminRes = await fetch('/admin-data-manager.html', {
              headers: { 'Authorization': 'Basic ' + loginData.token }
            });

            if (adminRes.ok) {
              resultDiv.innerHTML += '<div class="result success"><strong>✅ Success!</strong> Admin panel is accessible.<br><br><strong>Next step:</strong> <a href="/admin-data-manager.html" target="_blank">Go to admin panel →</a></div>';
            } else {
              resultDiv.innerHTML += '<div class="result error"><strong>❌ Failed to access admin panel.</strong><br>Status: ' + adminRes.status + '</div>';
            }
          } catch (error) {
            resultDiv.innerHTML += '<div class="result error"><strong>❌ Error:</strong><pre>' + error.message + '</pre></div>';
          }
        });
      </script>
    </body>
    </html>
  `);
});

// NOW add static middleware AFTER auth routes so admin-data-manager.html goes through auth first
// Configure static middleware to skip admin-data-manager.html (let our route handle it)
app.use(express.static('public', {
  skip: (req) => {
    return req.path === '/admin-data-manager.html';
  }
}));

// Data storage
let data = {
  stations: [],
  trains: [],
  trainStations: [],
  liveTrains: [],
  lastUpdated: null
};

// Local data path (primary and only source)
const LOCAL_DATA_PATH = './public/data';
const SOCKET_URL = 'https://socket.pakraillive.com';

// Load local JSON file
function loadLocalFile(filename) {
  try {
    const _fs = require('fs');
    const _path = require('path');
    const filePath = _path.join(LOCAL_DATA_PATH, filename);
    const fileContent = _fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error(`❌ Error loading ${filename}:`, error.message);
    return null;
  }
}

// Fetch static data from local files only
function fetchStaticData() {
  try {
    console.log('🔄 Loading static data from local files...');

    // Load stations data
    const stationsData = loadLocalFile('stations.json');
    if (stationsData) {
      data.stations = Array.isArray(stationsData.Response) ? stationsData.Response :
                     Array.isArray(stationsData) ? stationsData : [];
      console.log(`✅ Loaded ${data.stations.length} stations`);
    } else {
      console.error('❌ Failed to load stations.json');
      data.stations = [];
    }

    // Load trains data
    const trainsData = loadLocalFile('trains.json');
    if (trainsData) {
      data.trains = Array.isArray(trainsData.Response) ? trainsData.Response :
                   Array.isArray(trainsData) ? trainsData : [];
      console.log(`✅ Loaded ${data.trains.length} trains`);
    } else {
      console.error('❌ Failed to load trains.json');
      data.trains = [];
    }

    // Load schedules data
    const schedulesData = loadLocalFile('schedules.json');
    if (schedulesData) {
      data.trainStations = Array.isArray(schedulesData.Response) ? schedulesData.Response :
                          Array.isArray(schedulesData) ? schedulesData : [];
      console.log(`✅ Loaded ${data.trainStations.length} schedules`);
    } else {
      console.error('❌ Failed to load schedules.json');
      data.trainStations = [];
    }

    data.lastUpdated = new Date().toISOString();
    console.log('✅ All static data loaded from local files');

  } catch (error) {
    console.error('❌ Error during data load:', error.message);
    data.stations = [];
    data.trains = [];
    data.trainStations = [];
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
    // socket.io-client will automatically reconnect based on the reconnection config
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

// Health check endpoint
app.get('/health', (_, res) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    data: {
      trains: data.trains.length,
      stations: data.stations.length,
      liveTrains: data.liveTrains.length,
      lastDataUpdate: data.lastUpdated
    }
  };

  res.json(healthStatus);
});

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

// =====================================================
// DATA MANAGEMENT ENDPOINTS (for admin panel)
// =====================================================

const fs = require('fs');
const path = require('path');

// Save trains data
app.post('/api/save-trains', authMiddleware, (req, res) => {
  try {
    const filePath = path.join(__dirname, 'public', 'data', 'trains.json');
    fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2));
    data.trains = req.body.Response || req.body;

    console.log('✅ Trains data updated');
    res.json({
      success: true,
      message: 'Trains data saved successfully',
      count: (req.body.Response || req.body).length
    });
  } catch (error) {
    console.error('❌ Error saving trains:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Save stations data
app.post('/api/save-stations', authMiddleware, (req, res) => {
  try {
    const filePath = path.join(__dirname, 'public', 'data', 'stations.json');
    fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2));
    data.stations = req.body.Response || req.body;

    console.log('✅ Stations data updated');
    res.json({
      success: true,
      message: 'Stations data saved successfully',
      count: (req.body.Response || req.body).length
    });
  } catch (error) {
    console.error('❌ Error saving stations:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Save schedules data
app.post('/api/save-schedules', authMiddleware, (req, res) => {
  try {
    const filePath = path.join(__dirname, 'public', 'data', 'schedules.json');
    fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2));
    data.trainStations = req.body.Response || req.body;

    console.log('✅ Schedules data updated');
    res.json({
      success: true,
      message: 'Schedules data saved successfully',
      count: (req.body.Response || req.body).length
    });
  } catch (error) {
    console.error('❌ Error saving schedules:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get data file info
app.get('/api/data-info', (req, res) => {
  try {
    const dataDir = path.join(__dirname, 'public', 'data');
    const files = ['trains.json', 'stations.json', 'schedules.json', 'version.json'];

    const info = {};
    files.forEach(file => {
      const filePath = path.join(dataDir, file);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        info[file] = {
          size: stats.size,
          sizeKB: (stats.size / 1024).toFixed(2),
          modified: stats.mtime,
          exists: true
        };
      }
    });

    res.json({
      success: true,
      dataDirectory: dataDir,
      files: info
    });
  } catch (error) {
    console.error('❌ Error getting data info:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
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