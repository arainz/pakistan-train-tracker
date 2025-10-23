<?php
// Diagnostic script for Pakistan Train Tracker PHP deployment
header('Content-Type: text/html; charset=utf-8');

echo "<h1>🐘 Pakistan Train Tracker - PHP Diagnostic</h1>";

// Test basic PHP functionality
echo "<h2>✅ PHP Basic Tests</h2>";
echo "<p><strong>PHP Version:</strong> " . phpversion() . "</p>";
echo "<p><strong>Server Time:</strong> " . date('Y-m-d H:i:s T') . "</p>";
echo "<p><strong>Server:</strong> " . $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown' . "</p>";
echo "<p><strong>Document Root:</strong> " . $_SERVER['DOCUMENT_ROOT'] ?? 'Unknown' . "</p>";
echo "<p><strong>Script Path:</strong> " . __FILE__ . "</p>";

// Test required PHP functions
echo "<h2>🔧 PHP Functions Check</h2>";
$functions = ['file_get_contents', 'json_decode', 'json_encode', 'curl_init', 'mkdir'];
foreach ($functions as $func) {
    $exists = function_exists($func);
    echo "<p><strong>$func:</strong> " . ($exists ? "✅ Available" : "❌ Missing") . "</p>";
}

// Test PHP settings
echo "<h2>⚙️ PHP Settings</h2>";
$settings = [
    'allow_url_fopen' => ini_get('allow_url_fopen'),
    'memory_limit' => ini_get('memory_limit'),
    'max_execution_time' => ini_get('max_execution_time'),
    'file_uploads' => ini_get('file_uploads'),
    'upload_max_filesize' => ini_get('upload_max_filesize')
];

foreach ($settings as $name => $value) {
    $status = $value ? "✅ $value" : "❌ Disabled";
    echo "<p><strong>$name:</strong> $status</p>";
}

// Test file permissions
echo "<h2>📁 File System Tests</h2>";
$cacheDir = __DIR__ . '/cache';

echo "<p><strong>Current Directory:</strong> " . __DIR__ . "</p>";
echo "<p><strong>Current Directory Writable:</strong> " . (is_writable(__DIR__) ? "✅ Yes" : "❌ No") . "</p>";

if (!is_dir($cacheDir)) {
    $created = @mkdir($cacheDir, 0755, true);
    echo "<p><strong>Cache Directory Created:</strong> " . ($created ? "✅ Yes" : "❌ Failed") . "</p>";
} else {
    echo "<p><strong>Cache Directory Exists:</strong> ✅ Yes</p>";
}

echo "<p><strong>Cache Directory Writable:</strong> " . (is_writable($cacheDir) ? "✅ Yes" : "❌ No") . "</p>";

// Test external API access
echo "<h2>🌐 External API Tests</h2>";
$testUrl = 'https://trackyourtrains.com/data/Trains.json?v=2025-06-06';

echo "<p><strong>Testing URL:</strong> $testUrl</p>";

$context = stream_context_create([
    'http' => [
        'method' => 'GET',
        'header' => 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'timeout' => 30
    ]
]);

$startTime = microtime(true);
$response = @file_get_contents($testUrl, false, $context);
$endTime = microtime(true);
$duration = round(($endTime - $startTime) * 1000, 2);

if ($response !== false) {
    $data = json_decode($response, true);
    $dataCount = 0;
    
    if ($data && isset($data['Response'])) {
        $dataCount = count($data['Response']);
    } elseif (is_array($data)) {
        $dataCount = count($data);
    }
    
    echo "<p><strong>API Response:</strong> ✅ Success ({$duration}ms)</p>";
    echo "<p><strong>Data Size:</strong> " . strlen($response) . " bytes</p>";
    echo "<p><strong>Train Records:</strong> $dataCount</p>";
    echo "<p><strong>Sample Data:</strong><br><code>" . htmlspecialchars(substr($response, 0, 200)) . "...</code></p>";
} else {
    echo "<p><strong>API Response:</strong> ❌ Failed</p>";
    $error = error_get_last();
    if ($error) {
        echo "<p><strong>Error:</strong> " . htmlspecialchars($error['message']) . "</p>";
    }
}

// Test API endpoints
echo "<h2>🔌 API Endpoint Tests</h2>";
$baseUrl = 'http://' . $_SERVER['HTTP_HOST'] . dirname($_SERVER['REQUEST_URI']);
$endpoints = ['api.php', 'api.php?endpoint=trains', 'api.php?endpoint=stations'];

foreach ($endpoints as $endpoint) {
    $url = $baseUrl . '/' . $endpoint;
    echo "<p><strong>Testing:</strong> <a href='$url' target='_blank'>$endpoint</a></p>";
}

// JavaScript test
echo "<h2>🟨 JavaScript Socket.IO Test</h2>";
?>
<div id="socketTest">
    <p><strong>Socket.IO Test:</strong> <span id="socketStatus">⏳ Testing...</span></p>
    <div id="socketDetails" style="font-family: monospace; background: #f5f5f5; padding: 10px; margin: 10px 0;"></div>
</div>

<script>
async function testSocketIO() {
    const status = document.getElementById('socketStatus');
    const details = document.getElementById('socketDetails');
    
    try {
        status.textContent = '🔄 Connecting to Socket.IO...';
        details.innerHTML = 'Attempting connection...\n';
        
        // Test Socket.IO polling
        const response = await fetch('https://socket.pakraillive.com/socket.io/?EIO=4&transport=polling');
        
        if (response.ok) {
            const text = await response.text();
            status.textContent = '✅ Socket.IO accessible';
            details.innerHTML += `Response: ${text.substring(0, 100)}...\n`;
            
            // Try to extract session ID
            const match = text.match(/\{"sid":"([^"]+)"/);
            if (match) {
                details.innerHTML += `Session ID: ${match[1]}\n`;
                status.textContent = '✅ Socket.IO connection successful';
            }
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
    } catch (error) {
        status.textContent = '❌ Socket.IO failed';
        details.innerHTML += `Error: ${error.message}\n`;
    }
}

// Run the test
testSocketIO();
</script>

<?php
echo "<h2>📋 Next Steps</h2>";
echo "<ol>";
echo "<li>Check all ✅ items are working</li>";
echo "<li>Fix any ❌ issues shown above</li>";
echo "<li>Test API endpoints by clicking the links</li>";
echo "<li>Check browser console for JavaScript errors</li>";
echo "<li>Upload the main files if this test passes</li>";
echo "</ol>";

echo "<h2>📞 Support Information</h2>";
echo "<p>If you see issues above, please share:</p>";
echo "<ul>";
echo "<li>Your hosting provider name</li>";
echo "<li>Any ❌ items from this page</li>";
echo "<li>Your website URL</li>";
echo "<li>Any error messages</li>";
echo "</ul>";

echo "<hr>";
echo "<p><small>Generated at " . date('Y-m-d H:i:s T') . " | Pakistan Train Tracker PHP Diagnostic v1.0</small></p>";
?>