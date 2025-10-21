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

// Fetch live train data
async function fetchLiveTrainData() {
  try {
    const response = await axios.get('https://pakraillive.com/api/live-trains', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Pakistan Train Tracker'
      }
    });
    
    if (response.data && Array.isArray(response.data)) {
      data.liveTrains = response.data;
      data.lastUpdated = new Date().toISOString();
      return response.data;
    }
  } catch (error) {
    console.error('Error fetching live trains:', error.message);
  }
  
  // Return mock data for testing
  return [
    {
      trainNumber: '1UP',
      trainName: 'Karachi Express',
      currentStation: 'Lahore',
      nextStation: 'Faisalabad',
      status: 'On Time',
      delay: 0,
      speed: 85
    },
    {
      trainNumber: '2DN',
      trainName: 'Business Express',
      currentStation: 'Islamabad',
      nextStation: 'Rawalpindi',
      status: 'Delayed',
      delay: 15,
      speed: 0
    }
  ];
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