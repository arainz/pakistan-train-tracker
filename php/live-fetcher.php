<?php
/**
 * Server-side live data fetcher for Pakistan Train Tracker
 * This script runs on the server and fetches real-time data
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// Cache settings
$cacheFile = __DIR__ . '/cache/live-trains.json';
$cacheMaxAge = 60; // 1 minute cache

// Check if we have recent cached data
if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $cacheMaxAge) {
    echo file_get_contents($cacheFile);
    exit;
}

// Function to fetch via HTTP (since PHP can't do WebSocket easily)
function fetchLiveTrainsHTTP() {
    // Try multiple endpoints
    $endpoints = [
        'https://pakraillive.com/api/live-trains',
        'https://api.pakraillive.com/trains/live',
        'https://trackyourtrains.com/api/live'
    ];
    
    foreach ($endpoints as $url) {
        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'header' => [
                    'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept: application/json',
                    'Referer: https://pakraillive.com/',
                    'Cache-Control: no-cache'
                ],
                'timeout' => 30
            ]
        ]);
        
        $response = @file_get_contents($url, false, $context);
        if ($response !== false) {
            $data = json_decode($response, true);
            if ($data && is_array($data) && count($data) > 5) {
                return $data;
            }
        }
    }
    
    return false;
}

// Function to fetch via cURL with Socket.IO simulation
function fetchLiveTrainsSocketIO() {
    try {
        $socketUrl = 'https://socket.pakraillive.com/socket.io/?EIO=4&transport=polling';
        
        // Initialize cURL
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $socketUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        
        // Get session
        $sessionResponse = curl_exec($ch);
        if (curl_error($ch)) {
            curl_close($ch);
            return false;
        }
        
        // Parse session ID
        if (preg_match('/\{"sid":"([^"]+)"/', $sessionResponse, $matches)) {
            $sessionId = $matches[1];
            
            // Send request for trains
            $postUrl = $socketUrl . '&sid=' . $sessionId;
            curl_setopt($ch, CURLOPT_URL, $postUrl);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, '42["all-newtrains"]');
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: text/plain;charset=UTF-8',
                'Accept: */*'
            ]);
            
            curl_exec($ch);
            
            // Poll for response
            curl_setopt($ch, CURLOPT_POST, false);
            sleep(2); // Wait for response
            
            $response = curl_exec($ch);
            curl_close($ch);
            
            // Parse response
            if (preg_match('/42\["all-newtrains",(\{.*?\})\]/', $response, $matches)) {
                $trainsData = json_decode($matches[1], true);
                if ($trainsData && is_array($trainsData)) {
                    return $trainsData;
                }
            }
        }
        
        curl_close($ch);
    } catch (Exception $e) {
        error_log("Socket.IO fetch error: " . $e->getMessage());
    }
    
    return false;
}

// Try to fetch live data
$liveData = fetchLiveTrainsHTTP();
if (!$liveData) {
    $liveData = fetchLiveTrainsSocketIO();
}

$result = [];

if ($liveData) {
    // Process the live data similar to Node.js version
    foreach ($liveData as $trainKey => $trainData) {
        if (is_array($trainData)) {
            foreach ($trainData as $innerKey => $train) {
                if (is_array($train) && isset($train['lat']) && isset($train['lon'])) {
                    $result[] = [
                        'TrainId' => $trainKey,
                        'InnerKey' => $innerKey,
                        'LocomotiveNumber' => $train['locomitiveNo'] ?? '',
                        'Latitude' => (float)$train['lat'],
                        'Longitude' => (float)$train['lon'],
                        'Speed' => (int)($train['sp'] ?? 0),
                        'LateBy' => (int)($train['late_by'] ?? 0),
                        'NextStationId' => $train['next_station'] ?? '',
                        'NextStation' => $train['next_stop'] ?? '',
                        'PrevStationId' => $train['prev_station'] ?? '',
                        'NextStationETA' => $train['NextStationETA'] ?? '',
                        'LastUpdated' => date('c', (int)($train['last_updated'] ?? time())),
                        'Status' => $train['st'] ?? 'Unknown',
                        'Icon' => $train['icon'] ?? '',
                        'IsLive' => true
                    ];
                }
            }
        }
    }
}

// If no live data, use enhanced fallback
if (empty($result)) {
    $result = [
        [
            'TrainId' => '9900001',
            'InnerKey' => '11001',
            'TrainName' => 'Karachi Express',
            'TrainNumber' => '1UP',
            'LocomotiveNumber' => 'ENG001',
            'Latitude' => 31.5204 + (rand(-100, 100) / 10000),
            'Longitude' => 74.3587 + (rand(-100, 100) / 10000),
            'Speed' => rand(60, 120),
            'LateBy' => rand(-5, 30),
            'NextStation' => 'Faisalabad Junction',
            'Status' => rand(0, 1) ? 'On Time' : 'Delayed',
            'LastUpdated' => date('c'),
            'IsLive' => false
        ],
        [
            'TrainId' => '9900002',
            'InnerKey' => '22001',
            'TrainName' => 'Business Express',
            'TrainNumber' => '2DN',
            'LocomotiveNumber' => 'ENG002',
            'Latitude' => 33.6844 + (rand(-100, 100) / 10000),
            'Longitude' => 73.0479 + (rand(-100, 100) / 10000),
            'Speed' => rand(0, 100),
            'LateBy' => rand(0, 45),
            'NextStation' => 'Rawalpindi Cantt',
            'Status' => rand(0, 1) ? 'Running' : 'Delayed',
            'LastUpdated' => date('c'),
            'IsLive' => false
        ],
        [
            'TrainId' => '9900003',
            'InnerKey' => '33001',
            'TrainName' => 'Millat Express',
            'TrainNumber' => '3UP',
            'LocomotiveNumber' => 'ENG003',
            'Latitude' => 30.1575 + (rand(-100, 100) / 10000),
            'Longitude' => 71.5249 + (rand(-100, 100) / 10000),
            'Speed' => rand(70, 110),
            'LateBy' => rand(-10, 20),
            'NextStation' => 'Bahawalpur',
            'Status' => 'On Time',
            'LastUpdated' => date('c'),
            'IsLive' => false
        ]
    ];
}

// Prepare response
$response = [
    'success' => true,
    'data' => $result,
    'count' => count($result),
    'lastUpdated' => date('c'),
    'isRealTime' => !empty($liveData),
    'source' => !empty($liveData) ? 'live' : 'fallback'
];

// Cache the response
if (!file_exists(dirname($cacheFile))) {
    @mkdir(dirname($cacheFile), 0755, true);
}
@file_put_contents($cacheFile, json_encode($response));

// Return response
echo json_encode($response);
?>