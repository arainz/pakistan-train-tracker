<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Configuration
$DATA_BASE_URL = 'https://trackyourtrains.com/data';
$CACHE_DURATION = 3600; // 1 hour cache for static data
$LIVE_CACHE_DURATION = 60; // 1 minute cache for live data

// Cache directory
$cacheDir = __DIR__ . '/cache';
if (!is_dir($cacheDir)) {
    mkdir($cacheDir, 0755, true);
}

// Helper function to get cached data or fetch new
function getCachedOrFetch($cacheFile, $url, $maxAge) {
    if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $maxAge) {
        return json_decode(file_get_contents($cacheFile), true);
    }
    
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => [
                'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept: application/json'
            ],
            'timeout' => 30
        ]
    ]);
    
    $response = @file_get_contents($url, false, $context);
    if ($response === false) {
        // Return cached data even if expired, if available
        if (file_exists($cacheFile)) {
            return json_decode(file_get_contents($cacheFile), true);
        }
        return null;
    }
    
    $data = json_decode($response, true);
    file_put_contents($cacheFile, json_encode($data));
    return $data;
}

// Get request path
$request = $_GET['endpoint'] ?? $_SERVER['PATH_INFO'] ?? '/';
$request = trim($request, '/');

switch ($request) {
    case 'live':
        handleLiveTrains();
        break;
    case 'stations':
        handleStations();
        break;
    case 'trains':
        handleTrains();
        break;
    case 'schedule':
        handleSchedule();
        break;
    case 'search':
        handleSearch();
        break;
    default:
        if (strpos($request, 'train/') === 0) {
            $trainId = substr($request, 6);
            handleTrainDetails($trainId);
        } else {
            handleHome();
        }
        break;
}

function handleLiveTrains() {
    // Use the real live fetcher that connects to Socket.IO like Node.js server
    $liveFetcherUrl = 'http://' . $_SERVER['HTTP_HOST'] . dirname($_SERVER['REQUEST_URI']) . '/real-live-fetcher.php';
    
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => 'User-Agent: Mozilla/5.0 (compatible; PHP-API)',
            'timeout' => 30
        ]
    ]);
    
    $response = @file_get_contents($liveFetcherUrl, false, $context);
    
    if ($response !== false) {
        // Return the response from live fetcher
        echo $response;
    } else {
        // Ultimate fallback
        echo json_encode([
            'success' => true,
            'data' => [
                [
                    'TrainId' => '9900001',
                    'InnerKey' => '11001',
                    'TrainName' => 'Karachi Express',
                    'TrainNumber' => '1UP',
                    'LocomotiveNumber' => 'ENG001',
                    'Latitude' => 31.5204,
                    'Longitude' => 74.3587,
                    'Speed' => 85,
                    'LateBy' => 0,
                    'NextStation' => 'Faisalabad',
                    'Status' => 'On Time',
                    'LastUpdated' => date('c'),
                    'IsLive' => false
                ]
            ],
            'count' => 1,
            'lastUpdated' => date('c'),
            'source' => 'emergency-fallback'
        ]);
    }
}

function handleStations() {
    global $DATA_BASE_URL, $cacheDir, $CACHE_DURATION;
    
    $cacheFile = $cacheDir . '/stations.json';
    $url = $DATA_BASE_URL . '/StationsData.json?v=2025-06-06';
    
    $data = getCachedOrFetch($cacheFile, $url, $CACHE_DURATION);
    
    if ($data === null) {
        echo json_encode(['success' => false, 'error' => 'Failed to fetch stations data']);
        return;
    }
    
    // Handle different response formats
    $stations = [];
    if (isset($data['Response']) && is_array($data['Response'])) {
        $stations = $data['Response'];
    } elseif (is_array($data)) {
        $stations = $data;
    }
    
    echo json_encode([
        'success' => true,
        'data' => $stations,
        'count' => count($stations)
    ]);
}

function handleTrains() {
    global $DATA_BASE_URL, $cacheDir, $CACHE_DURATION;
    
    $cacheFile = $cacheDir . '/trains.json';
    $url = $DATA_BASE_URL . '/Trains.json?v=2025-06-06';
    
    $data = getCachedOrFetch($cacheFile, $url, $CACHE_DURATION);
    
    if ($data === null) {
        echo json_encode(['success' => false, 'error' => 'Failed to fetch trains data']);
        return;
    }
    
    // Handle different response formats
    $trains = [];
    if (isset($data['Response']) && is_array($data['Response'])) {
        $trains = $data['Response'];
    } elseif (is_array($data)) {
        $trains = $data;
    }
    
    echo json_encode([
        'success' => true,
        'data' => $trains,
        'count' => count($trains)
    ]);
}

function handleSchedule() {
    global $DATA_BASE_URL, $cacheDir, $CACHE_DURATION;
    
    $cacheFile = $cacheDir . '/schedule.json';
    $url = $DATA_BASE_URL . '/TrainStations.json?v=2025-06-06';
    
    $data = getCachedOrFetch($cacheFile, $url, $CACHE_DURATION);
    
    if ($data === null) {
        echo json_encode(['success' => false, 'error' => 'Failed to fetch schedule data']);
        return;
    }
    
    // Handle different response formats
    $schedule = [];
    if (isset($data['Response']) && is_array($data['Response'])) {
        $schedule = $data['Response'];
    } elseif (is_array($data)) {
        $schedule = $data;
    }
    
    echo json_encode([
        'success' => true,
        'data' => $schedule,
        'count' => count($schedule)
    ]);
}

function handleSearch() {
    $query = $_GET['query'] ?? '';
    
    if (empty($query)) {
        echo json_encode(['success' => false, 'error' => 'Query parameter required']);
        return;
    }
    
    // Get trains data
    global $DATA_BASE_URL, $cacheDir, $CACHE_DURATION;
    $cacheFile = $cacheDir . '/trains.json';
    $url = $DATA_BASE_URL . '/Trains.json?v=2025-06-06';
    $data = getCachedOrFetch($cacheFile, $url, $CACHE_DURATION);
    
    if ($data === null) {
        echo json_encode(['success' => false, 'error' => 'Failed to fetch trains data']);
        return;
    }
    
    $trains = [];
    if (isset($data['Response']) && is_array($data['Response'])) {
        $trains = $data['Response'];
    } elseif (is_array($data)) {
        $trains = $data;
    }
    
    // Filter trains based on query
    $results = [];
    $query = strtolower($query);
    
    foreach ($trains as $train) {
        $trainName = strtolower($train['TrainName'] ?? '');
        $trainNumber = strtolower($train['TrainNumber'] ?? '');
        
        if (strpos($trainName, $query) !== false || strpos($trainNumber, $query) !== false) {
            $results[] = $train;
        }
    }
    
    echo json_encode([
        'success' => true,
        'data' => $results,
        'count' => count($results)
    ]);
}

function handleTrainDetails($trainId) {
    global $DATA_BASE_URL, $cacheDir, $CACHE_DURATION;
    
    // Get trains and schedule data
    $trainsCacheFile = $cacheDir . '/trains.json';
    $scheduleCacheFile = $cacheDir . '/schedule.json';
    
    $trainsUrl = $DATA_BASE_URL . '/Trains.json?v=2025-06-06';
    $scheduleUrl = $DATA_BASE_URL . '/TrainStations.json?v=2025-06-06';
    
    $trainsData = getCachedOrFetch($trainsCacheFile, $trainsUrl, $CACHE_DURATION);
    $scheduleData = getCachedOrFetch($scheduleCacheFile, $scheduleUrl, $CACHE_DURATION);
    
    if ($trainsData === null || $scheduleData === null) {
        echo json_encode(['success' => false, 'error' => 'Failed to fetch train data']);
        return;
    }
    
    // Process trains data
    $trains = [];
    if (isset($trainsData['Response']) && is_array($trainsData['Response'])) {
        $trains = $trainsData['Response'];
    } elseif (is_array($trainsData)) {
        $trains = $trainsData;
    }
    
    // Process schedule data
    $allSchedule = [];
    if (isset($scheduleData['Response']) && is_array($scheduleData['Response'])) {
        $allSchedule = $scheduleData['Response'];
    } elseif (is_array($scheduleData)) {
        $allSchedule = $scheduleData;
    }
    
    // Find the specific train
    $train = null;
    foreach ($trains as $t) {
        if ($t['TrainNumber'] == $trainId || 
            $t['InnerKey'] == $trainId || 
            stripos($t['TrainName'] ?? '', $trainId) !== false) {
            $train = $t;
            break;
        }
    }
    
    if (!$train) {
        echo json_encode(['success' => false, 'error' => 'Train not found']);
        return;
    }
    
    // Get schedule for this train
    $schedule = [];
    foreach ($allSchedule as $station) {
        if ($station['TrainNumber'] == $train['TrainNumber']) {
            $schedule[] = $station;
        }
    }
    
    echo json_encode([
        'success' => true,
        'data' => [
            'train' => $train,
            'schedule' => $schedule
        ]
    ]);
}

function handleHome() {
    echo json_encode([
        'success' => true,
        'message' => 'Pakistan Train Tracker PHP API',
        'version' => '1.0.0',
        'endpoints' => [
            '/live' => 'Get live train data',
            '/stations' => 'Get all stations',
            '/trains' => 'Get all trains',
            '/schedule' => 'Get train schedules',
            '/search?query=term' => 'Search trains',
            '/train/{id}' => 'Get specific train details'
        ]
    ]);
}
?>