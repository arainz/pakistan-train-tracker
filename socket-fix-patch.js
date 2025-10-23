// Socket.IO compatibility patch
// Replace the connectWebSocket function in server.js

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
      // Process trains data (same as before)
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

// Alternative connection method using HTTP polling
function tryAlternativeConnection() {
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