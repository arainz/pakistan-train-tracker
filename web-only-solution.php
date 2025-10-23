<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');

// Pakistan Train Tracker - Web-only solution (no custom ports)
// This PHP script acts as a proxy to get live train data

$action = $_GET['action'] ?? 'live';

function fetchLiveTrains() {
    // Try to get data from your Node.js server locally first
    $localUrl = 'http://localhost:3001/api/live';
    $context = stream_context_create([
        'http' => [
            'timeout' => 5,
            'method' => 'GET'
        ]
    ]);
    
    $result = @file_get_contents($localUrl, false, $context);
    
    if ($result !== false) {
        $data = json_decode($result, true);
        if ($data && isset($data['success']) && $data['success']) {
            return $data;
        }
    }
    
    // Fallback: Return mock data with note about Node.js server
    return [
        'success' => false,
        'error' => 'Node.js server not accessible internally',
        'message' => 'The Node.js server with live data is running but not accessible through PHP',
        'data' => [],
        'count' => 0,
        'lastUpdated' => date('c'),
        'localServerStatus' => 'Node.js server may be running on port 3001 but not accessible via internal network'
    ];
}

function fetchStaticData($type) {
    $baseUrl = 'https://trackyourtrains.com/data';
    
    $urls = [
        'stations' => "$baseUrl/StationsData.json?v=2025-06-06",
        'trains' => "$baseUrl/Trains.json?v=2025-06-06",
        'schedule' => "$baseUrl/TrainStations.json?v=2025-06-06"
    ];
    
    if (!isset($urls[$type])) {
        return ['success' => false, 'error' => 'Invalid data type'];
    }
    
    $context = stream_context_create([
        'http' => [
            'timeout' => 10,
            'method' => 'GET',
            'header' => 'User-Agent: Mozilla/5.0 (compatible; TrainTracker)'
        ]
    ]);
    
    $result = @file_get_contents($urls[$type], false, $context);
    
    if ($result === false) {
        return ['success' => false, 'error' => 'Failed to fetch data'];
    }
    
    $data = json_decode($result, true);
    if (!$data) {
        return ['success' => false, 'error' => 'Invalid JSON response'];
    }
    
    // Handle different response formats
    $responseData = $data['Response'] ?? $data;
    if (!is_array($responseData)) {
        $responseData = [$responseData];
    }
    
    return [
        'success' => true,
        'data' => $responseData,
        'count' => count($responseData),
        'lastUpdated' => date('c')
    ];
}

function checkNodeJSServer() {
    $ports = [3001, 3000, 8080];
    $results = [];
    
    foreach ($ports as $port) {
        $url = "http://localhost:$port/health";
        $context = stream_context_create([
            'http' => [
                'timeout' => 2,
                'method' => 'GET'
            ]
        ]);
        
        $result = @file_get_contents($url, false, $context);
        $results[$port] = $result !== false ? 'responding' : 'not responding';
    }
    
    return $results;
}

// Handle different actions
switch ($action) {
    case 'live':
        echo json_encode(fetchLiveTrains());
        break;
        
    case 'trains':
        echo json_encode(fetchStaticData('trains'));
        break;
        
    case 'stations':
        echo json_encode(fetchStaticData('stations'));
        break;
        
    case 'schedule':
        echo json_encode(fetchStaticData('schedule'));
        break;
        
    case 'health':
        $nodeStatus = checkNodeJSServer();
        echo json_encode([
            'success' => true,
            'status' => 'PHP proxy healthy',
            'timestamp' => date('c'),
            'nodeJSServerStatus' => $nodeStatus,
            'message' => 'This PHP script can access static data. For live data, Node.js server needs to be accessible.'
        ]);
        break;
        
    default:
        echo json_encode(['success' => false, 'error' => 'Unknown action']);
}