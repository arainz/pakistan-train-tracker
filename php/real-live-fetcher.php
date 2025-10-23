<?php
/**
 * Real live data fetcher - Exact replica of Node.js Socket.IO connection
 * This fetches the actual 72+ trains from socket.pakraillive.com
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// Cache settings - shorter cache for real-time data
$cacheFile = __DIR__ . '/cache/real-live-trains.json';
$cacheMaxAge = 20; // 20 seconds cache

// Check cache first
if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $cacheMaxAge) {
    echo file_get_contents($cacheFile);
    exit;
}

// Function to fetch real Socket.IO data using HTTP polling
function fetchRealSocketIOData() {
    $socketUrl = 'https://socket.pakraillive.com/socket.io/';
    $maxRetries = 3;
    
    for ($attempt = 1; $attempt <= $maxRetries; $attempt++) {
        try {
            error_log("Attempt $attempt: Connecting to Socket.IO...");
            
            // Step 1: Establish Socket.IO session
            $sessionUrl = $socketUrl . '?EIO=4&transport=polling&t=' . time();
            
            $ch = curl_init();
            curl_setopt_array($ch, [
                CURLOPT_URL => $sessionUrl,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_TIMEOUT => 30,
                CURLOPT_CONNECTTIMEOUT => 15,
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_SSL_VERIFYHOST => false,
                CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                CURLOPT_HTTPHEADER => [
                    'Accept: */*',
                    'Accept-Encoding: gzip, deflate, br',
                    'Accept-Language: en-US,en;q=0.9',
                    'Cache-Control: no-cache',
                    'Pragma: no-cache',
                    'Referer: https://pakraillive.com/',
                    'Origin: https://pakraillive.com'
                ]
            ]);
            
            $sessionResponse = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            
            if (curl_error($ch) || $httpCode !== 200) {
                error_log("Session request failed: " . curl_error($ch) . " (HTTP $httpCode)");
                curl_close($ch);
                continue;
            }
            
            // Parse session ID from response like "97:0{"sid":"abc123",...}"
            if (preg_match('/\{"sid":"([^"]+)"/', $sessionResponse, $matches)) {
                $sessionId = $matches[1];
                error_log("Got session ID: " . substr($sessionId, 0, 8) . "...");
            } else {
                error_log("No session ID found in response: " . substr($sessionResponse, 0, 200));
                curl_close($ch);
                continue;
            }
            
            // Step 2: Send request for all trains
            $requestUrl = $socketUrl . '?EIO=4&transport=polling&sid=' . $sessionId;
            $requestPayload = '42["all-newtrains"]';  // Exact message from Node.js
            
            curl_setopt_array($ch, [
                CURLOPT_URL => $requestUrl,
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $requestPayload,
                CURLOPT_HTTPHEADER => [
                    'Content-Type: text/plain;charset=UTF-8',
                    'Accept: */*',
                    'Accept-Encoding: gzip, deflate, br',
                    'Accept-Language: en-US,en;q=0.9',
                    'Cache-Control: no-cache',
                    'Pragma: no-cache',
                    'Referer: https://pakraillive.com/',
                    'Origin: https://pakraillive.com'
                ]
            ]);
            
            $postResponse = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            
            if (curl_error($ch) || $httpCode !== 200) {
                error_log("POST request failed: " . curl_error($ch) . " (HTTP $httpCode)");
                curl_close($ch);
                continue;
            }
            
            // Step 3: Poll for response with multiple attempts
            curl_setopt($ch, CURLOPT_POST, false);
            curl_setopt($ch, CURLOPT_POSTFIELDS, null);
            
            $maxPolls = 10;
            for ($poll = 1; $poll <= $maxPolls; $poll++) {
                usleep(500000); // Wait 0.5 seconds between polls
                
                $pollUrl = $socketUrl . '?EIO=4&transport=polling&sid=' . $sessionId . '&t=' . (time() + $poll);
                curl_setopt($ch, CURLOPT_URL, $pollUrl);
                
                $pollResponse = curl_exec($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                
                if (curl_error($ch) || $httpCode !== 200) {
                    error_log("Poll $poll failed: " . curl_error($ch) . " (HTTP $httpCode)");
                    continue;
                }
                
                error_log("Poll $poll response length: " . strlen($pollResponse));
                
                // Look for all-newtrains response: 42["all-newtrains",{...}]
                if (preg_match('/42\["all-newtrains",(\{.*?\})\]/', $pollResponse, $matches)) {
                    $trainsJson = $matches[1];
                    error_log("Found trains data! Length: " . strlen($trainsJson));
                    
                    $trainsData = json_decode($trainsJson, true);
                    if ($trainsData && is_array($trainsData)) {
                        curl_close($ch);
                        return $trainsData;
                    }
                } else if (strlen($pollResponse) > 10) {
                    error_log("Poll response sample: " . substr($pollResponse, 0, 200));
                }
            }
            
            curl_close($ch);
            error_log("No trains data found after $maxPolls polls");
            
        } catch (Exception $e) {
            error_log("Exception in attempt $attempt: " . $e->getMessage());
            if (isset($ch)) curl_close($ch);
        }
    }
    
    return false;
}

// Function to process raw Socket.IO data like Node.js server
function processSocketIOTrains($rawTrains) {
    if (!$rawTrains || !is_array($rawTrains)) {
        return [];
    }
    
    $processedTrains = [];
    
    foreach ($rawTrains as $trainKey => $trainData) {
        if (!is_array($trainData)) continue;
        
        foreach ($trainData as $innerKey => $train) {
            if (!is_array($train) || !isset($train['lat']) || !isset($train['lon'])) {
                continue;
            }
            
            $formattedTrain = [
                'TrainId' => $trainKey,
                'InnerKey' => $innerKey,
                'LocomotiveNumber' => $train['locomitiveNo'] ?? '',
                'Latitude' => (float)($train['lat'] ?? 0),
                'Longitude' => (float)($train['lon'] ?? 0),
                'Speed' => (int)($train['sp'] ?? 0),
                'LateBy' => (int)($train['late_by'] ?? 0),
                'NextStationId' => $train['next_station'] ?? '',
                'NextStation' => $train['next_stop'] ?? 'Unknown',
                'PrevStationId' => $train['prev_station'] ?? '',
                'NextStationETA' => $train['NextStationETA'] ?? '',
                'LastUpdated' => date('c', (int)($train['last_updated'] ?? time())),
                'Status' => $train['st'] ?? 'Unknown',
                'Icon' => $train['icon'] ?? '',
                'IsLive' => true
            ];
            
            // Try to match with static train data for names
            // This would require loading the trains data, but for now just use the key
            if (strlen($trainKey) > 2) {
                $formattedTrain['TrainName'] = 'Train ' . $trainKey;
                $formattedTrain['TrainNumber'] = $innerKey;
            }
            
            $processedTrains[] = $formattedTrain;
        }
    }
    
    return $processedTrains;
}

// Main execution
error_log("Starting real live data fetch...");

$rawTrains = fetchRealSocketIOData();
$processedTrains = [];

if ($rawTrains) {
    $processedTrains = processSocketIOTrains($rawTrains);
    error_log("Successfully processed " . count($processedTrains) . " trains");
    
    $result = [
        'success' => true,
        'data' => $processedTrains,
        'count' => count($processedTrains),
        'lastUpdated' => date('c'),
        'isRealTime' => true,
        'source' => 'socket.pakraillive.com',
        'method' => 'socket.io-polling'
    ];
} else {
    error_log("Failed to fetch real data, using fallback");
    
    // Minimal fallback - just one train to show it's working
    $result = [
        'success' => true,
        'data' => [
            [
                'TrainId' => 'FALLBACK',
                'InnerKey' => '99999',
                'TrainName' => 'API Connection Failed',
                'TrainNumber' => 'ERR',
                'LocomotiveNumber' => 'N/A',
                'Latitude' => 31.5204,
                'Longitude' => 74.3587,
                'Speed' => 0,
                'LateBy' => 0,
                'NextStation' => 'Reconnecting...',
                'Status' => 'Connection Lost',
                'LastUpdated' => date('c'),
                'IsLive' => false
            ]
        ],
        'count' => 1,
        'lastUpdated' => date('c'),
        'isRealTime' => false,
        'source' => 'fallback',
        'error' => 'Could not connect to live data source'
    ];
}

// Cache the result
if (!file_exists(dirname($cacheFile))) {
    @mkdir(dirname($cacheFile), 0755, true);
}
@file_put_contents($cacheFile, json_encode($result));

// Log the final result
error_log("Returning " . count($result['data']) . " trains, real-time: " . ($result['isRealTime'] ? 'YES' : 'NO'));

echo json_encode($result);
?>