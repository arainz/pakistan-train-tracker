// Get train ID from URL
const urlParams = new URLSearchParams(window.location.search);
const trainId = urlParams.get('id');

let map;
let trainMarker;
let routeLine;
let stationMarkers = [];
let trainData = null;
let scheduleData = null;

// Helper function to format minutes into hours and minutes
function formatMinutes(minutes) {
    if (!minutes || minutes === 0) return '0 min';
    const hours = Math.floor(Math.abs(minutes) / 60);
    const mins = Math.abs(minutes) % 60;
    if (hours > 0) {
        return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
    }
    return `${mins}min`;
}

// Helper function to format time in AM/PM
function formatTime(timeString) {
    if (!timeString || timeString === 'N/A') return 'N/A';
    try {
        // Check if it's a time-only string (HH:MM or HH:MM:SS format)
        const timePattern = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
        const match = timeString.match(timePattern);
        
        if (match) {
            const hours = parseInt(match[1]);
            const minutes = parseInt(match[2]);
            const seconds = match[3] ? parseInt(match[3]) : 0;
            
            const date = new Date();
            date.setHours(hours, minutes, seconds, 0);
            return date.toLocaleTimeString([], { 
                hour: 'numeric', 
                minute: '2-digit', 
                hour12: true 
            });
        }
        
        // Otherwise try to parse as full date
        const date = new Date(timeString);
        if (isNaN(date.getTime())) {
            return timeString; // Return original if invalid
        }
        return date.toLocaleTimeString([], { 
            hour: 'numeric', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: true 
        });
    } catch (e) {
        return timeString;
    }
}

console.log('🚂 TRAIN PAGE DEBUG - Train page loaded with ID:', trainId);
console.log('🚂 TRAIN PAGE DEBUG - URL search params:', window.location.search);
console.log('🚂 CACHE BUSTER - NEW Script version: train-new.js');
console.log('🚂 CACHE BUSTER - Loading time:', new Date().toISOString());

// Show a temporary alert to confirm new script is loading
if (!document.getElementById('newScriptIndicator')) {
    const indicator = document.createElement('div');
    indicator.id = 'newScriptIndicator';
    indicator.style.cssText = `
        position: fixed; 
        top: 10px; 
        right: 10px; 
        background: #4CAF50; 
        color: white; 
        padding: 10px 15px; 
        border-radius: 5px; 
        z-index: 10000;
        font-size: 12px;
    `;
    indicator.textContent = '✅ NEW SCRIPT LOADED';
    document.body.appendChild(indicator);
    
    // Remove after 3 seconds
    setTimeout(() => {
        if (document.getElementById('newScriptIndicator')) {
            document.getElementById('newScriptIndicator').remove();
        }
    }, 3000);
}

// Function to show "out of coverage" message
function showOutOfCoverageMessage(trainId) {
    // Hide all normal content sections
    document.querySelector('.train-header').style.display = 'none';
    document.querySelector('.main-content').style.display = 'none';
    document.querySelectorAll('.route-progress').forEach(section => {
        section.style.display = 'none';
    });
    
    // Create and show out of coverage message
    const container = document.querySelector('.container');
    const outOfCoverageHtml = `
        <div class="out-of-coverage-message" style="
            text-align: center;
            padding: 60px 30px;
            background: white;
            border-radius: 20px;
            margin: 60px 0;
        ">
            <div style="
                font-size: 4em;
                margin-bottom: 20px;
                color: #e74c3c;
            ">🚫</div>
            
            <h1 style="
                color: #2c3e50;
                font-size: 2.5em;
                margin-bottom: 15px;
                font-weight: 600;
            ">Train Out of Coverage</h1>
            
            <p style="
                color: #7f8c8d;
                font-size: 1.2em;
                margin-bottom: 25px;
                line-height: 1.6;
            ">
                Train ID <strong>${trainId}</strong> is not currently being tracked.<br>
                This train might be:
            </p>
            
            <div style="
                background: #f8f9fa;
                border-radius: 15px;
                padding: 25px;
                margin: 30px 0;
                text-align: left;
                max-width: 500px;
                margin-left: auto;
                margin-right: auto;
            ">
                <ul style="
                    list-style: none;
                    padding: 0;
                    margin: 0;
                    color: #6c757d;
                ">
                    <li style="margin-bottom: 10px;">📍 Not currently running</li>
                    <li style="margin-bottom: 10px;">🛑 Out of service today</li>
                    <li style="margin-bottom: 10px;">📡 Outside tracking coverage area</li>
                    <li>🔧 Temporarily unavailable</li>
                </ul>
            </div>
            
            <div style="margin-top: 30px;">
                <a href="/" style="
                    display: inline-block;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 15px 30px;
                    border-radius: 50px;
                    text-decoration: none;
                    font-size: 1.1em;
                    font-weight: 600;
                    transition: transform 0.3s, box-shadow 0.3s;
                " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 25px rgba(0,0,0,0.15)'" 
                   onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                    ← Back to Active Trains
                </a>
            </div>
            
            <p style="
                color: #bdc3c7;
                font-size: 0.9em;
                margin-top: 25px;
                font-style: italic;
            ">
                Currently tracking ${document.getElementById('trainCount')?.textContent || '79 active trains'}
            </p>
        </div>
    `;
    
    container.innerHTML = `
        <a href="/" class="back-button">← Back to Dashboard</a>
        ${outOfCoverageHtml}
    `;
}

// Function to show error message
function showErrorMessage(errorMsg, trainId) {
    // Hide all normal content sections
    document.querySelector('.train-header').style.display = 'none';
    document.querySelector('.main-content').style.display = 'none';
    document.querySelectorAll('.route-progress').forEach(section => {
        section.style.display = 'none';
    });
    
    // Create and show error message
    const container = document.querySelector('.container');
    const errorHtml = `
        <div class="error-message" style="
            text-align: center;
            padding: 60px 30px;
            background: white;
            border-radius: 20px;
            margin: 60px 0;
        ">
            <div style="
                font-size: 4em;
                margin-bottom: 20px;
                color: #e74c3c;
            ">⚠️</div>
            
            <h1 style="
                color: #2c3e50;
                font-size: 2.5em;
                margin-bottom: 15px;
                font-weight: 600;
            ">Loading Error</h1>
            
            <p style="
                color: #7f8c8d;
                font-size: 1.2em;
                margin-bottom: 25px;
                line-height: 1.6;
            ">
                Unable to load data for train <strong>${trainId}</strong><br>
                <span style="font-size: 0.9em; color: #95a5a6;">${errorMsg}</span>
            </p>
            
            <div style="margin-top: 30px;">
                <button onclick="location.reload()" style="
                    background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
                    color: white;
                    padding: 15px 30px;
                    border: none;
                    border-radius: 50px;
                    font-size: 1.1em;
                    font-weight: 600;
                    cursor: pointer;
                    margin-right: 15px;
                    transition: transform 0.3s, box-shadow 0.3s;
                " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 25px rgba(0,0,0,0.15)'" 
                   onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                    🔄 Try Again
                </button>
                
                <a href="/" style="
                    display: inline-block;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 15px 30px;
                    border-radius: 50px;
                    text-decoration: none;
                    font-size: 1.1em;
                    font-weight: 600;
                    transition: transform 0.3s, box-shadow 0.3s;
                " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 25px rgba(0,0,0,0.15)'" 
                   onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                    ← Back to Dashboard
                </a>
            </div>
        </div>
    `;
    
    container.innerHTML = `
        <a href="/" class="back-button">← Back to Dashboard</a>
        ${errorHtml}
    `;
}

// Calculate bearing between two points (in degrees)
function calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    bearing = (bearing + 360) % 360; // Normalize to 0-360
    
    return bearing;
}

// Initialize map
function initMap(lat = 30.3753, lon = 69.3451) {
    map = L.map('map').setView([lat, lon], 7);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    console.log('Map initialized');
}

// Fetch and display train data
async function fetchTrainData() {
    console.log('Starting fetchTrainData...');
    
    if (!trainId) {
        console.error('No train ID provided');
        document.getElementById('trainName').textContent = 'No train ID provided';
        return;
    }
    
    try {
        console.log('Fetching live data for train:', trainId);
        
        // Fetch live data
        const liveResponse = await fetch(getAPIUrl('live'));
        const liveData = await liveResponse.json();
        
        console.log('Live API response success:', liveData.success);
        console.log('Total trains in response:', liveData.data?.length || 0);
        
        if (!liveData.success) {
            throw new Error('Live API failed');
        }
        
        // Find train by InnerKey first
        console.log('🔍 SEARCH DEBUG - Looking for train with ID:', trainId, '(type:', typeof trainId, ')');
        console.log('🔍 SEARCH DEBUG - Total trains in API response:', liveData.data.length);
        
        // Log first few trains to see what data structure we're getting
        console.log('🔍 SEARCH DEBUG - Sample train data from API:');
        liveData.data.slice(0, 3).forEach((t, index) => {
            console.log(`  [${index}] InnerKey: "${t.InnerKey}", TrainId: "${t.TrainId}", TrainNumber: "${t.TrainNumber}", TrainName: "${t.TrainName}"`);
        });
        
        let train = liveData.data.find(t => t.InnerKey === trainId);
        console.log('🔍 SEARCH DEBUG - Search by InnerKey result:', train ? 'Found' : 'Not found');
        if (train) {
            console.log('🔍 SEARCH DEBUG - Found train by InnerKey:', {
                InnerKey: train.InnerKey,
                TrainId: train.TrainId,
                TrainNumber: train.TrainNumber,
                TrainName: train.TrainName
            });
        }
        
        // If not found by InnerKey, try by TrainId
        if (!train) {
            train = liveData.data.find(t => t.TrainId === trainId);
            console.log('🔍 SEARCH DEBUG - Search by TrainId result:', train ? 'Found' : 'Not found');
            if (train) {
                console.log('🔍 SEARCH DEBUG - Found train by TrainId:', {
                    InnerKey: train.InnerKey,
                    TrainId: train.TrainId,
                    TrainNumber: train.TrainNumber,
                    TrainName: train.TrainName
                });
            }
        }
        
        // Try by TrainNumber as well
        if (!train) {
            train = liveData.data.find(t => t.TrainNumber === trainId);
            console.log('🔍 SEARCH DEBUG - Search by TrainNumber result:', train ? 'Found' : 'Not found');
            if (train) {
                console.log('🔍 SEARCH DEBUG - Found train by TrainNumber:', {
                    InnerKey: train.InnerKey,
                    TrainId: train.TrainId,
                    TrainNumber: train.TrainNumber,
                    TrainName: train.TrainName
                });
            }
        }
        
        if (!train) {
            console.error('❌ TRAIN NOT FOUND - Search criteria:', trainId);
            console.error('Available trains (first 10):');
            liveData.data.slice(0, 10).forEach(t => {
                console.log(`- InnerKey: "${t.InnerKey}", TrainId: "${t.TrainId}", TrainNumber: "${t.TrainNumber}", Name: "${t.TrainName}"`);
            });
            console.error(`Total available trains: ${liveData.data.length}`);
            
            // Check if this specific train ID exists anywhere in the data
            const foundById = liveData.data.find(t => t.TrainId === trainId || t.InnerKey === trainId || t.TrainNumber === trainId);
            if (foundById) {
                console.error('🚨 UNEXPECTED: Train ID was found but not matched in search logic!');
                console.error('Found train data:', foundById);
            } else {
                console.log('✅ Confirmed: Train ID does not exist in API data');
            }
            
            // Show user-friendly "out of coverage" message
            showOutOfCoverageMessage(trainId);
            return;
        }
        
        console.log('Train found:', {
            InnerKey: train.InnerKey,
            TrainId: train.TrainId,
            TrainName: train.TrainName,
            TrainNumber: train.TrainNumber,
            Speed: train.Speed,
            Latitude: train.Latitude,
            Longitude: train.Longitude
        });
        
        
        trainData = train;
        
        // Get schedule data first to ensure proper direction calculation
        if (train.TrainNumber) {
            console.log('Fetching schedule for train number:', train.TrainNumber);
            
            const schedResponse = await fetch(`${API_CONFIG.getBaseURL()}/api/train/${train.TrainNumber}`);
            const schedData = await schedResponse.json();
            
            console.log('Schedule API response success:', schedData.success);
            console.log('Schedule data available:', schedData.data?.schedule?.length || 0, 'stations');
            
            if (schedData.success && schedData.data && schedData.data.schedule && schedData.data.schedule.length > 0) {
                scheduleData = schedData.data.schedule; // Store schedule data globally
                console.log('Schedule data loaded, now updating train info with correct direction');
                
                // Update train info with schedule data available for correct direction
                updateTrainInfo(train);
                
                // Display route and progress
                displayRoute(schedData.data.schedule);
                updateProgress(train, schedData.data.schedule);
            } else {
                console.log('No schedule data available, updating train info with fallback direction');
                // Update train info without schedule data (will use fallback direction)
                updateTrainInfo(train);
                document.getElementById('stationList').innerHTML = '<p style="text-align: center; color: #999;">No route information available.</p>';
            }
        } else {
            console.log('No train number available for schedule lookup');
            // Update train info without schedule data
            updateTrainInfo(train);
            document.getElementById('stationList').innerHTML = '<p style="text-align: center; color: #999;">No train number available for schedule lookup.</p>';
        }
        
    } catch (error) {
        console.error('❌ ERROR in fetchTrainData:', error);
        showErrorMessage(error.message, trainId);
    }
}


// Update train information display
function updateTrainInfo(train) {
    console.log('Updating train info display...');
    
    try {
        // Header information
        const trainNumber = train.TrainNumber || train.InnerKey || 'N/A';
        const trainName = train.TrainName || train.trainName || `Train ${trainNumber}`;
        
        console.log('Setting train number:', trainNumber);
        console.log('Setting train name:', trainName);
        
        document.getElementById('trainNumber').textContent = trainNumber;
        document.getElementById('trainName').textContent = trainName;
        
        // Stats
        const speed = train.Speed || 0;
        const lateBy = train.LateBy || 0;
        let status = 'On Time';
        
        if (lateBy > 0) status = `Late ${formatMinutes(lateBy)}`;
        else if (lateBy < 0) status = `Early ${formatMinutes(lateBy)}`;
        
        console.log('Setting speed:', speed);
        console.log('Setting status:', status);
        
        // Determine movement status
        const movementStatus = speed > 0 ? 'Moving' : 'Stopped';
        const movementClass = speed > 0 ? 'status-moving' : 'status-stopped';
        
        document.getElementById('currentSpeed').textContent = `${speed} km/h`;
        document.getElementById('movementStatus').innerHTML = `<span class="status-badge ${movementClass}">${movementStatus}</span>`;
        document.getElementById('trainStatus').textContent = status;
        document.getElementById('nextStation').textContent = train.NextStation || 'N/A';
        document.getElementById('nextETA').textContent = formatTime(train.NextStationETA) || 'N/A';
        document.getElementById('locomotive').textContent = train.LocomotiveNumber || 'N/A';
        
        // Additional info
        document.getElementById('trainId').textContent = train.TrainId || 'N/A';
        document.getElementById('direction').textContent = String(trainNumber).includes('DN') ? 'Down' : 'Up';
        document.getElementById('lastUpdate').textContent = train.LastUpdated ? 
            new Date(train.LastUpdated).toLocaleString([], { 
                month: 'short',
                day: 'numeric',
                hour: 'numeric', 
                minute: '2-digit', 
                second: '2-digit',
                hour12: true 
            }) : 'N/A';
        document.getElementById('coordinates').textContent = 
            `${train.Latitude?.toFixed(4) || 'N/A'}, ${train.Longitude?.toFixed(4) || 'N/A'}`;
        
        console.log('Basic info updated successfully');
        
        // Update map
        if (train.Latitude && train.Longitude) {
            console.log('Updating map with coordinates:', train.Latitude, train.Longitude);
            
            if (!map) {
                console.log('Initializing map...');
                initMap(train.Latitude, train.Longitude);
            }
            
            // Remove old marker if exists
            if (trainMarker) {
                map.removeLayer(trainMarker);
            }
            
            // Calculate train direction based on actual track alignment
            let trainRotation = '0deg';
            
            // If we have schedule data, calculate precise bearing based on train's position relative to stations
            if (scheduleData && scheduleData.length > 0) {
                const nextStationId = train.NextStationId;
                const prevStationId = train.PrevStationId;
                
                // Find current position in the route
                const nextStationIndex = scheduleData.findIndex(s => String(s.StationId) === String(nextStationId));
                const prevStationIndex = scheduleData.findIndex(s => String(s.StationId) === String(prevStationId));
                
                let fromLat, fromLon, toLat, toLon;
                let bestMethod = '';
                
                // Method 1: Use current train position to next station (most accurate for real-time positioning)
                if (nextStationIndex >= 0) {
                    const nextStation = scheduleData[nextStationIndex];
                    if (nextStation.Latitude && nextStation.Longitude) {
                        fromLat = train.Latitude;
                        fromLon = train.Longitude;
                        toLat = nextStation.Latitude;
                        toLon = nextStation.Longitude;
                        bestMethod = 'train-to-next';
                    }
                }
                
                // Method 2: Use previous station to next station if train position method failed
                if (!fromLat && prevStationIndex >= 0 && nextStationIndex >= 0 && prevStationIndex !== nextStationIndex) {
                    const prevStation = scheduleData[prevStationIndex];
                    const nextStation = scheduleData[nextStationIndex];
                    
                    if (prevStation.Latitude && prevStation.Longitude && nextStation.Latitude && nextStation.Longitude) {
                        fromLat = prevStation.Latitude;
                        fromLon = prevStation.Longitude;
                        toLat = nextStation.Latitude;
                        toLon = nextStation.Longitude;
                        bestMethod = 'prev-to-next';
                    }
                }
                
                // Method 3: Use sequential stations in route as final fallback
                if (!fromLat && nextStationIndex > 0) {
                    const prevStation = scheduleData[nextStationIndex - 1];
                    const nextStation = scheduleData[nextStationIndex];
                    
                    if (prevStation.Latitude && prevStation.Longitude && nextStation.Latitude && nextStation.Longitude) {
                        fromLat = prevStation.Latitude;
                        fromLon = prevStation.Longitude;
                        toLat = nextStation.Latitude;
                        toLon = nextStation.Longitude;
                        bestMethod = 'sequential';
                    }
                }
                
                // Calculate precise bearing for track alignment
                if (fromLat && fromLon && toLat && toLon) {
                    const bearing = calculateBearing(fromLat, fromLon, toLat, toLon);
                    
                    // Use the calculated bearing directly for realistic track alignment
                    // No arbitrary adjustments - let the train follow the actual track direction
                    trainRotation = `${bearing}deg`;
                    
                    console.log(`🛤️ PRECISE TRACK ALIGNMENT - Method: ${bestMethod}, Track bearing: ${bearing}°`);
                    console.log(`📍 Coordinates: (${fromLat.toFixed(4)}, ${fromLon.toFixed(4)}) → (${toLat.toFixed(4)}, ${toLon.toFixed(4)})`);
                }
            }
            
            // Only use UP/DOWN fallback if no route bearing was calculated
            if (trainRotation === '0deg') {
                const trainNameForDetection = String(trainName || trainNumber || '');
                const isUpTrain = trainNameForDetection.includes('UP') || trainNameForDetection.includes('up') || trainNameForDetection.includes('1UP');
                // Use cardinal directions for fallback
                trainRotation = isUpTrain ? '90deg' : '270deg';  // East for UP, West for DOWN
                console.log('📍 FALLBACK - Using UP/DOWN cardinal direction:', isUpTrain ? 'UP (East)' : 'DOWN (West)', '→', trainRotation);
            } else {
                console.log('✅ Using precise track-based rotation:', trainRotation);
            }
            
            // Use animated GIF for train based on direction
            const trainNameForGif = String(trainName || trainNumber || '');
            const isUpTrainForGif = trainNameForGif.includes('UP') || trainNameForGif.includes('up') || trainNameForGif.includes('1UP');
            
            // Use PNG image for UP trains, WEBP for DOWN trains
            const trainGif = isUpTrainForGif ? 
                `<img src="locomotive_1f682.png" style="width: 24px; height: 24px;" alt="locomotive"/>` :
                `<img src="locomotive_1f682.webp" style="width: 24px; height: 24px;" alt="locomotive"/>`;
            
            // Add realistic train icon positioned precisely on the track
            const trainIcon = L.divIcon({
                html: `
                    <div class="train-container" style="
                        width: 28px; 
                        height: 28px; 
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        position: relative;
                        transform: rotate(${trainRotation});
                        background: transparent;
                    ">
                        <div class="train-body" style="
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            animation: trainMovement 2s infinite ease-in-out;
                            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));
                        ">
                            ${trainGif}
                        </div>
                    </div>
                    <style>
                        @keyframes trainMovement {
                            0%, 100% { 
                                transform: scale(1);
                                filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));
                            }
                            50% { 
                                transform: scale(1.05);
                                filter: drop-shadow(0 3px 6px rgba(102, 126, 234, 0.8));
                            }
                        }
                        .train-on-track-marker {
                            z-index: 1000 !important;
                        }
                    </style>
                `,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
                popupAnchor: [0, -14],
                className: 'train-on-track-marker'
            });
            
            // Position locomotive exactly on the track line (similar to progress bar)
            trainMarker = L.marker([train.Latitude, train.Longitude], {
                icon: trainIcon,
                zIndexOffset: 1000 // Ensure train appears above track
            }).addTo(map);
            
            // Add popup with train info
            const popupContent = `
                <strong>${trainName}</strong><br>
                Train #${trainNumber}<br>
                Speed: ${speed} km/h<br>
                Status: ${status}<br>
                Next: ${train.NextStation || 'N/A'}<br>
                ETA: ${formatTime(train.NextStationETA) || 'N/A'}<br>
                Locomotive: ${train.LocomotiveNumber || 'N/A'}
            `;
            trainMarker.bindPopup(popupContent).openPopup();
            
            // Center map on train with animation at much closer zoom
            map.flyTo([train.Latitude, train.Longitude], 15);
            console.log('Map updated successfully');
        } else {
            console.log('No GPS coordinates available');
            // Initialize map anyway
            if (!map) {
                console.log('Initializing map without coordinates...');
                initMap();
            }
        }
        
        console.log('Train info update completed successfully');
        
    } catch (error) {
        console.error('Error in updateTrainInfo:', error);
        document.getElementById('trainName').textContent = 'Error updating display: ' + error.message;
    }
}

// Display route stations
function displayRoute(stations) {
    console.log('Displaying route with stations:', stations);
    
    if (!stations || stations.length === 0) {
        console.log('No stations to display');
        return;
    }
    
    const container = document.getElementById('stationList');
    if (!container) {
        console.log('Station list container not found');
        return;
    }
    
    const currentStationId = trainData?.NextStationId;
    let foundCurrent = false;
    
    // Clear existing station markers
    stationMarkers.forEach(marker => {
        if (map) map.removeLayer(marker);
    });
    stationMarkers = [];
    
    // Create station list HTML
    let html = '';
    const coordinates = [];
    
    stations.forEach((station, index) => {
        let statusClass = 'upcoming';
        
        if (String(station.StationId) === String(currentStationId)) {
            statusClass = 'current';
            foundCurrent = true;
        } else if (!foundCurrent) {
            statusClass = 'passed';
        }
        
        // Determine status icon
        const iconSymbol = statusClass === 'passed' ? '✓' : 
                          statusClass === 'current' ? '●' : 
                          index + 1;
        
        // Calculate adjusted times based on delay
        const adjustTime = (timeStr, delayMinutes) => {
            if (!timeStr || timeStr === '--:--') return '--:--';
            
            try {
                const [hours, minutes] = timeStr.split(':').map(Number);
                const totalMinutes = hours * 60 + minutes + delayMinutes;
                const adjustedHours = Math.floor(totalMinutes / 60) % 24;
                const adjustedMins = totalMinutes % 60;
                
                // Convert to AM/PM format
                const adjustedTimeStr = `${adjustedHours.toString().padStart(2, '0')}:${adjustedMins.toString().padStart(2, '0')}`;
                return formatTime(adjustedTimeStr);
            } catch (e) {
                return timeStr;
            }
        };
        
        const delayMinutes = trainData?.LateBy || 0;
        const originalTime = station.DepartureTime || station.ArrivalTime || '--:--';
        
        // Calculate display time based on station status
        let displayTime;
        if (statusClass === 'passed') {
            // For passed stations, show the actual time it passed (scheduled + delay)
            displayTime = adjustTime(originalTime, delayMinutes);
        } else if (statusClass === 'current') {
            // For current station, show adjusted ETA
            displayTime = adjustTime(originalTime, delayMinutes);
        } else {
            // For future stations, show adjusted time with current delay
            displayTime = adjustTime(originalTime, delayMinutes);
        }
        
        // Get current time only for current station (with seconds for initial display)
        const currentTime = new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit',
            hour12: true 
        });
        
        // Determine station status display and time information
        let statusDisplay = '';
        let timeDisplay = '';
        let currentTimeDisplay = '';
        
        if (statusClass === 'passed') {
            statusDisplay = '✅ Passed';
            timeDisplay = ''; // No time display for passed stations
            currentTimeDisplay = ''; // No current time for passed stations
        } else if (statusClass === 'current') {
            statusDisplay = '🚂 Current Station';
            // Show both scheduled and ETA for current station
            const scheduledTime = formatTime(originalTime) || '--:--';
            timeDisplay = `
                <div style="font-size: 12px; line-height: 1.3;">
                    <div><strong>Scheduled:</strong> ${scheduledTime}</div>
                    <div><strong>ETA:</strong> ${displayTime}</div>
                </div>
            `;
            currentTimeDisplay = `
                <div class="current-time" id="realtime-clock" style="font-size: 10px; color: #007bff; font-weight: bold; margin-top: 4px; padding: 2px 6px; background: #e3f2fd; border-radius: 4px;">
                    Time: ${currentTime}
                </div>
            `;
        } else {
            statusDisplay = `⏰ Not Passed Yet`;
            // Show both scheduled and ETA for upcoming stations
            const scheduledTime = formatTime(originalTime) || '--:--';
            timeDisplay = `
                <div style="font-size: 12px; line-height: 1.3;">
                    <div><strong>Scheduled:</strong> ${scheduledTime}</div>
                    <div><strong>ETA:</strong> ${displayTime}</div>
                </div>
            `;
            currentTimeDisplay = ''; // No current time for upcoming stations
        }
        
        html += `
            <div class="station-item ${statusClass}">
                <div class="station-info">
                    <div class="station-icon">${iconSymbol}</div>
                    <div>
                        <div class="station-name">${station.StationName || station.stationName || 'Station'}</div>
                        <div class="station-name-urdu">${station.StationNameUrdu || ''}</div>
                    </div>
                </div>
                <div class="station-status">
                    <div class="eta-info">
                        ${timeDisplay}
                    </div>
                    <div class="actual-info" style="margin-top: 4px;">
                        ${statusDisplay}
                    </div>
                    ${currentTimeDisplay}
                </div>
            </div>
        `;
        
        // Collect coordinates for route line
        if (station.Latitude && station.Longitude) {
            coordinates.push([station.Latitude, station.Longitude]);
            
            // Add station markers to map
            if (map) {
                const marker = L.circleMarker([station.Latitude, station.Longitude], {
                    radius: statusClass === 'current' ? 8 : 5,
                    fillColor: statusClass === 'passed' ? '#48bb78' : 
                               statusClass === 'current' ? '#667eea' : '#e0e0e0',
                    color: '#fff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.8
                }).addTo(map);
                
                marker.bindPopup(`<strong>${station.StationName}</strong><br>
                    Arrival: ${formatTime(station.ArrivalTime) || '--:--'}<br>
                    Departure: ${formatTime(station.DepartureTime) || '--:--'}`);
                
                stationMarkers.push(marker);
            }
        }
    });
    
    console.log('Setting station list HTML');
    container.innerHTML = html;
    
    // Draw route line on map
    if (map && coordinates.length > 1) {
        if (routeLine) {
            map.removeLayer(routeLine);
            if (routeLine.trackRails) {
                map.removeLayer(routeLine.trackRails);
            }
        }
        
        // Create base track line
        routeLine = L.polyline(coordinates, {
            color: '#8B4513',
            weight: 8,
            opacity: 0.8
        }).addTo(map);
        
        // Add track rails on top
        const trackRails = L.polyline(coordinates, {
            color: '#C0C0C0',
            weight: 2,
            opacity: 1,
            dashArray: '5,2'
        }).addTo(map);
        
        // Store reference to track rails for cleanup
        routeLine.trackRails = trackRails;
        
        // Fit map to show entire route
        map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
    }
    
    // Update origin and destination
    if (stations.length > 0) {
        const originEl = document.getElementById('originStation');
        const destEl = document.getElementById('destinationStation');
        
        if (originEl) {
            originEl.textContent = stations[0].StationName || stations[0].stationName || 'Origin';
        }
        if (destEl) {
            destEl.textContent = stations[stations.length - 1].StationName || stations[stations.length - 1].stationName || 'Destination';
        }
    }
}

// Update journey progress
function updateProgress(train, stations) {
    if (!stations || stations.length === 0) return;
    
    // Find current position in route
    const currentStationId = train.NextStationId;
    let currentIndex = stations.findIndex(s => String(s.StationId) === String(currentStationId));
    
    if (currentIndex === -1) currentIndex = 0;
    
    // Calculate progress percentage
    const progress = Math.round((currentIndex / (stations.length - 1)) * 100);
    
    // Use locomotive PNG image for progress bar
    const trainNumber = train.TrainNumber || train.InnerKey || '';
    const isUpTrain = String(trainNumber).includes('UP') || String(trainNumber).includes('up');
    const progressTrainIcon = '<img src="locomotive_1f682.png" style="width: 40px; height: 40px; vertical-align: middle;" alt="locomotive"/>';
    console.log('PROGRESS BAR - Using locomotive PNG image');
    
    // Update progress bar
    document.getElementById('progressBar').style.width = `${progress}%`;
    document.getElementById('progressText').textContent = `${progress}% Complete`;
    document.getElementById('progressPercent').textContent = `${progress}%`;
    document.getElementById('trainIcon').style.left = `${progress}%`;
    document.getElementById('trainIcon').innerHTML = progressTrainIcon;
    
    console.log(`Progress: ${progress}% | Direction: ${isUpTrain ? 'UP (←)' : 'DOWN (→)'} | Icon: ${progressTrainIcon}`);
}

// Real-time clock function
function startRealTimeClock() {
    setInterval(() => {
        const clockElement = document.getElementById('realtime-clock');
        if (clockElement) {
            const currentTime = new Date().toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit',
                hour12: true 
            });
            clockElement.textContent = `Time: ${currentTime}`;
        }
    }, 1000); // Update every second
}

// Auto-refresh data
function startAutoRefresh() {
    setInterval(() => {
        fetchTrainData();
    }, 10000); // Refresh every 10 seconds
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    fetchTrainData();
    startAutoRefresh();
    startRealTimeClock(); // Start the real-time clock
});