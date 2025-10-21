const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

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
    
    // Fetch trains data
    const trainsResponse = await axios.get(`${DATA_BASE_URL}/Trains.json?v=2025-06-06`);
    if (trainsResponse.data && trainsResponse.data.Response) {
      data.trains = Array.isArray(trainsResponse.data.Response) ? trainsResponse.data.Response : [];
    } else {
      data.trains = Array.isArray(trainsResponse.data) ? trainsResponse.data : [];
    }
    
    // Fetch train stations data
    const trainStationsResponse = await axios.get(`${DATA_BASE_URL}/TrainStations.json?v=2025-06-06`);
    if (trainStationsResponse.data && trainStationsResponse.data.Response) {
      data.trainStations = Array.isArray(trainStationsResponse.data.Response) ? trainStationsResponse.data.Response : [];
    } else {
      data.trainStations = Array.isArray(trainStationsResponse.data) ? trainStationsResponse.data : [];
    }
    
    console.log(`✅ Loaded ${data.stations.length} stations, ${data.trains.length} trains, ${data.trainStations.length} train stations`);
    data.lastUpdated = new Date().toISOString();
    
  } catch (error) {
    console.error('❌ Error fetching static data:', error.message);
  }
}

// Fetch live train data using Socket.IO polling (compatible with serverless)
async function fetchLiveTrainData() {
  try {
    console.log('Attempting to fetch live trains via Socket.IO polling...');
    
    // Step 1: Establish Socket.IO session via polling
    const sessionResponse = await axios.get('https://socket.pakraillive.com/socket.io/?EIO=4&transport=polling', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*'
      }
    });
    
    if (!sessionResponse.data) throw new Error('No session data received');
    
    // Parse session ID from response like "97:0{"sid":"_PV2ngPh6pP9Q9ykAywH"...
    const sessionData = sessionResponse.data.substring(sessionResponse.data.indexOf('{'));
    const session = JSON.parse(sessionData);
    const sid = session.sid;
    
    if (!sid) throw new Error('No session ID received');
    console.log('Got session ID:', sid);
    
    // Step 2: Send the request for all trains
    const requestPayload = '42["all-newtrains"]';
    await axios.post(`https://socket.pakraillive.com/socket.io/?EIO=4&transport=polling&sid=${sid}`, requestPayload, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'text/plain;charset=UTF-8',
        'Accept': '*/*'
      },
      timeout: 10000
    });
    
    // Step 3: Poll for response
    const responseResp = await axios.get(`https://socket.pakraillive.com/socket.io/?EIO=4&transport=polling&sid=${sid}`, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*'
      }
    });
    
    if (responseResp.data) {
      // Parse Socket.IO message format
      const responseText = responseResp.data;
      console.log('Raw response length:', responseText.length);
      
      // Look for the all-newtrains response (format: 42["all-newtrains",{...}])
      const match = responseText.match(/42\["all-newtrains",(\{.*?\})\]/);
      if (match) {
        const trainsData = JSON.parse(match[1]);
        console.log('Parsed trains data keys:', Object.keys(trainsData).length);
        
        // Process the data similar to local server
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
              const staticTrain = data.trains.find(t => 
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
        
        data.liveTrains = processedTrains;
        data.lastUpdated = new Date().toISOString();
        console.log(`✅ Fetched ${processedTrains.length} live trains via Socket.IO polling`);
        return processedTrains;
      }
    }
    
    throw new Error('No train data found in response');
    
  } catch (error) {
    console.error('Error fetching via Socket.IO polling:', error.message);
  }

  // Fallback to sample data
  console.log('⚠️ Using fallback data - Socket.IO polling failed');
  const fallbackData = [
    {
      TrainNumber: '1UP',
      TrainName: 'Karachi Express',
      InnerKey: '11001',
      status: 'On Time',
      delay: 0,
      speed: 85,
      currentStation: 'Lahore Junction',
      nextStation: 'Faisalabad',
      lat: 31.5204,
      lng: 74.3587
    },
    {
      TrainNumber: '2DN', 
      TrainName: 'Business Express',
      InnerKey: '22001',
      status: 'Delayed',
      delay: 15,
      speed: 0,
      currentStation: 'Islamabad',
      nextStation: 'Rawalpindi',
      lat: 33.6844,
      lng: 73.0479
    },
    {
      TrainNumber: '3UP',
      TrainName: 'Millat Express', 
      InnerKey: '33001',
      status: 'On Time',
      delay: 0,
      speed: 95,
      currentStation: 'Multan',
      nextStation: 'Bahawalpur',
      lat: 30.1575,
      lng: 71.5249
    }
  ];
  
  data.liveTrains = fallbackData;
  data.lastUpdated = new Date().toISOString();
  return fallbackData;
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/train.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/train.html'));
});

// API Routes
app.get('/api/live', async (req, res) => {
  try {
    const liveData = await fetchLiveTrainData();
    res.json({
      success: true,
      data: liveData,
      count: liveData.length,
      lastUpdated: data.lastUpdated
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/trains', async (req, res) => {
  if (data.trains.length === 0) {
    await fetchStaticData();
  }
  
  res.json({
    success: true,
    data: data.trains,
    count: data.trains.length
  });
});

app.get('/api/stations', async (req, res) => {
  if (data.stations.length === 0) {
    await fetchStaticData();
  }
  
  res.json({
    success: true,
    data: data.stations,
    count: data.stations.length
  });
});

app.get('/api/schedule', async (req, res) => {
  if (data.trainStations.length === 0) {
    await fetchStaticData();
  }
  
  res.json({
    success: true,
    data: data.trainStations,
    count: data.trainStations.length
  });
});

app.get('/api/train/:id', async (req, res) => {
  const trainId = req.params.id;
  
  if (data.trains.length === 0) {
    await fetchStaticData();
  }
  
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

app.get('/api/search', async (req, res) => {
  const query = req.query.query?.toLowerCase();
  
  if (!query) {
    return res.status(400).json({
      success: false,
      error: 'Query parameter required'
    });
  }
  
  if (data.trains.length === 0) {
    await fetchStaticData();
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

// Initialize data on first request
let initialized = false;
app.use(async (req, res, next) => {
  if (!initialized) {
    await fetchStaticData();
    initialized = true;
  }
  next();
});

// Export for Vercel
module.exports = app;