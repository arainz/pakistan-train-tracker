<?php
/**
 * Enhanced live data fetcher with more realistic train simulation
 * This creates a more comprehensive train tracking experience
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// Cache settings
$cacheFile = __DIR__ . '/cache/enhanced-live-trains.json';
$cacheMaxAge = 30; // 30 seconds for more frequent updates

// Check cache first
if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $cacheMaxAge) {
    echo file_get_contents($cacheFile);
    exit;
}

// Try to fetch real data first
function fetchRealData() {
    // Try the most reliable endpoints
    $endpoints = [
        'https://pakraillive.com/api/trains/live',
        'https://api.trackyourtrains.com/live',
        'https://pakrailapi.com/v1/trains/live'
    ];
    
    foreach ($endpoints as $url) {
        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'header' => [
                    'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept: application/json, text/plain, */*',
                    'Accept-Language: en-US,en;q=0.9',
                    'Referer: https://pakraillive.com/',
                    'Cache-Control: no-cache',
                    'Pragma: no-cache'
                ],
                'timeout' => 15
            ]
        ]);
        
        $response = @file_get_contents($url, false, $context);
        if ($response && strlen($response) > 100) {
            $data = json_decode($response, true);
            if ($data && is_array($data) && count($data) > 10) {
                return $data;
            }
        }
    }
    
    return false;
}

// Generate enhanced realistic train data
function generateEnhancedTrainData() {
    // Real Pakistan train routes and stations
    $realTrains = [
        ['name' => 'Karachi Express', 'number' => '1UP', 'route' => 'Karachi-Lahore', 'lat' => 31.5204, 'lng' => 74.3587],
        ['name' => 'Business Express', 'number' => '2DN', 'route' => 'Lahore-Karachi', 'lat' => 24.8607, 'lng' => 67.0011],
        ['name' => 'Millat Express', 'number' => '3UP', 'route' => 'Karachi-Sargodha', 'lat' => 30.1575, 'lng' => 71.5249],
        ['name' => 'Pakistan Express', 'number' => '4DN', 'route' => 'Lahore-Karachi', 'lat' => 29.3544, 'lng' => 71.6911],
        ['name' => 'Awam Express', 'number' => '5UP', 'route' => 'Karachi-Peshawar', 'lat' => 32.1877, 'lng' => 74.1945],
        ['name' => 'Green Line', 'number' => '6DN', 'route' => 'Islamabad-Karachi', 'lat' => 33.6844, 'lng' => 73.0479],
        ['name' => 'Khyber Mail', 'number' => '7UP', 'route' => 'Karachi-Peshawar', 'lat' => 34.0151, 'lng' => 71.5249],
        ['name' => 'Tezgam', 'number' => '8DN', 'route' => 'Karachi-Rawalpindi', 'lat' => 33.5651, 'lng' => 73.0169],
        ['name' => 'Allama Iqbal Express', 'number' => '9UP', 'route' => 'Karachi-Sialkot', 'lat' => 32.4945, 'lng' => 74.5229],
        ['name' => 'Shalimar Express', 'number' => '10DN', 'route' => 'Karachi-Lahore', 'lat' => 31.5497, 'lng' => 74.3436],
        ['name' => 'Jaffar Express', 'number' => '11UP', 'route' => 'Quetta-Peshawar', 'lat' => 30.1798, 'lng' => 66.9750],
        ['name' => 'Bolan Mail', 'number' => '12DN', 'route' => 'Quetta-Karachi', 'lat' => 30.1798, 'lng' => 66.9750],
        ['name' => 'Chiltan Express', 'number' => '13UP', 'route' => 'Quetta-Rawalpindi', 'lat' => 30.1798, 'lng' => 66.9750],
        ['name' => 'Akbar Express', 'number' => '14DN', 'route' => 'Quetta-Lahore', 'lat' => 30.1798, 'lng' => 66.9750],
        ['name' => 'Sukkur Express', 'number' => '15UP', 'route' => 'Karachi-Jacobabad', 'lat' => 27.7202, 'lng' => 68.4572],
        ['name' => 'Shah Abdul Latif Express', 'number' => '16DN', 'route' => 'Mirpur-Karachi', 'lat' => 26.0066, 'lng' => 68.3645],
        ['name' => 'Mehran Express', 'number' => '17UP', 'route' => 'Karachi-Mirpur', 'lat' => 25.3960, 'lng' => 68.3578],
        ['name' => 'Sindh Express', 'number' => '18DN', 'route' => 'Karachi-Sukkar', 'lat' => 27.7202, 'lng' => 68.4572],
        ['name' => 'Ravi Express', 'number' => '19UP', 'route' => 'Lahore-Karachi', 'lat' => 31.5204, 'lng' => 74.3587],
        ['name' => 'Chenab Express', 'number' => '20DN', 'route' => 'Lahore-Faisalabad', 'lat' => 31.4504, 'lng' => 73.1350],
        ['name' => 'Hazara Express', 'number' => '21UP', 'route' => 'Karachi-Havelian', 'lat' => 34.0515, 'lng' => 73.1566],
        ['name' => 'Margalla Express', 'number' => '22DN', 'route' => 'Islamabad-Karachi', 'lat' => 33.7215, 'lng' => 73.0433],
        ['name' => 'Capital Express', 'number' => '23UP', 'route' => 'Karachi-Islamabad', 'lat' => 33.6844, 'lng' => 73.0479],
        ['name' => 'Punjab Express', 'number' => '24DN', 'route' => 'Lahore-Multan', 'lat' => 30.1575, 'lng' => 71.5249],
        ['name' => 'Bahawalpur Express', 'number' => '25UP', 'route' => 'Karachi-Bahawalpur', 'lat' => 29.4000, 'lng' => 71.6833],
        ['name' => 'Sahiwal Express', 'number' => '26DN', 'route' => 'Lahore-Sahiwal', 'lat' => 30.6682, 'lng' => 73.1114],
        ['name' => 'Okara Express', 'number' => '27UP', 'route' => 'Lahore-Okara', 'lat' => 30.8081, 'lng' => 73.4534],
        ['name' => 'Gujranwala Express', 'number' => '28DN', 'route' => 'Lahore-Gujranwala', 'lat' => 32.1877, 'lng' => 74.1945],
        ['name' => 'Sialkot Express', 'number' => '29UP', 'route' => 'Lahore-Sialkot', 'lat' => 32.4945, 'lng' => 74.5229],
        ['name' => 'Peshawar Express', 'number' => '30DN', 'route' => 'Lahore-Peshawar', 'lat' => 34.0151, 'lng' => 71.5249],
        ['name' => 'Frontier Mail', 'number' => '31UP', 'route' => 'Karachi-Peshawar', 'lat' => 34.0151, 'lng' => 71.5249],
        ['name' => 'Khushhal Khan Khattak Express', 'number' => '32DN', 'route' => 'Karachi-Bannu', 'lat' => 32.9816, 'lng' => 70.6019],
        ['name' => 'Kohat Express', 'number' => '33UP', 'route' => 'Rawalpindi-Kohat', 'lat' => 33.5651, 'lng' => 71.4450],
        ['name' => 'Mardan Express', 'number' => '34DN', 'route' => 'Peshawar-Mardan', 'lat' => 34.1958, 'lng' => 72.0453],
        ['name' => 'Swat Express', 'number' => '35UP', 'route' => 'Peshawar-Mingora', 'lat' => 35.0178, 'lng' => 72.3633],
    ];
    
    $trains = [];
    $currentTime = time();
    
    foreach ($realTrains as $index => $train) {
        // Simulate movement and realistic variations
        $timeOffset = ($currentTime % 3600) / 3600; // Hour-based movement
        $trainOffset = $index * 0.1; // Each train moves differently
        
        // Add some realistic movement to coordinates
        $latVariation = sin($timeOffset + $trainOffset) * 0.1;
        $lngVariation = cos($timeOffset + $trainOffset) * 0.1;
        
        $trains[] = [
            'TrainId' => '99000' . str_pad($index + 1, 2, '0', STR_PAD_LEFT),
            'InnerKey' => ($index + 1) . '1001',
            'TrainName' => $train['name'],
            'TrainNumber' => $train['number'],
            'LocomotiveNumber' => 'ENG' . str_pad($index + 1, 3, '0', STR_PAD_LEFT),
            'Latitude' => round($train['lat'] + $latVariation, 6),
            'Longitude' => round($train['lng'] + $lngVariation, 6),
            'Speed' => rand(40, 120),
            'LateBy' => rand(-10, 45),
            'NextStation' => $this->getNextStation($train['route']),
            'PrevStation' => $this->getPrevStation($train['route']),
            'Route' => $train['route'],
            'Status' => $this->getRandomStatus(),
            'LastUpdated' => date('c'),
            'IsLive' => true,
            'Direction' => strpos($train['number'], 'UP') !== false ? 'Up' : 'Down',
            'EstimatedArrival' => date('H:i', $currentTime + rand(1800, 7200)),
            'Platform' => rand(1, 8),
            'Coach' => rand(8, 18) . ' coaches',
        ];
    }
    
    return $trains;
}

function getNextStation($route) {
    $stations = [
        'Karachi-Lahore' => ['Hyderabad', 'Sukkur', 'Multan', 'Sahiwal', 'Lahore'],
        'Lahore-Karachi' => ['Sahiwal', 'Multan', 'Sukkur', 'Hyderabad', 'Karachi'],
        'Karachi-Sargodha' => ['Hyderabad', 'Sukkur', 'Jhang', 'Sargodha'],
        'Karachi-Peshawar' => ['Hyderabad', 'Multan', 'Lahore', 'Rawalpindi', 'Peshawar'],
        'Islamabad-Karachi' => ['Rawalpindi', 'Lahore', 'Multan', 'Sukkur', 'Karachi'],
        'Quetta-Peshawar' => ['Sibi', 'Jacobabad', 'Multan', 'Lahore', 'Rawalpindi', 'Peshawar'],
        'Quetta-Karachi' => ['Sibi', 'Jacobabad', 'Sukkur', 'Hyderabad', 'Karachi'],
    ];
    
    $routeStations = $stations[$route] ?? ['Next Station'];
    return $routeStations[array_rand($routeStations)];
}

function getPrevStation($route) {
    $stations = [
        'Karachi-Lahore' => ['Karachi Cantt', 'Landhi', 'Hyderabad', 'Sukkur', 'Multan'],
        'Lahore-Karachi' => ['Lahore', 'Sahiwal', 'Multan', 'Sukkur', 'Hyderabad'],
    ];
    
    $routeStations = $stations[$route] ?? ['Previous Station'];
    return $routeStations[array_rand($routeStations)];
}

function getRandomStatus() {
    $statuses = ['On Time', 'Delayed', 'Running', 'Approaching', 'Departed'];
    $weights = [40, 25, 20, 10, 5]; // Probability weights
    
    $total = array_sum($weights);
    $random = rand(1, $total);
    $current = 0;
    
    for ($i = 0; $i < count($statuses); $i++) {
        $current += $weights[$i];
        if ($random <= $current) {
            return $statuses[$i];
        }
    }
    
    return 'On Time';
}

// Try real data first
$realData = fetchRealData();

if ($realData && count($realData) > 10) {
    $result = [
        'success' => true,
        'data' => $realData,
        'count' => count($realData),
        'lastUpdated' => date('c'),
        'isRealTime' => true,
        'source' => 'live-api'
    ];
} else {
    // Use enhanced simulation
    $trains = generateEnhancedTrainData();
    
    $result = [
        'success' => true,
        'data' => $trains,
        'count' => count($trains),
        'lastUpdated' => date('c'),
        'isRealTime' => false,
        'source' => 'enhanced-simulation',
        'note' => 'Real-time data unavailable, using enhanced simulation with ' . count($trains) . ' trains'
    ];
}

// Cache the result
if (!file_exists(dirname($cacheFile))) {
    @mkdir(dirname($cacheFile), 0755, true);
}
@file_put_contents($cacheFile, json_encode($result));

echo json_encode($result);
?>