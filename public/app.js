let currentTab = 'live';
let trainData = {
    active: [],
    schedule: [],
    searchResults: []
};

// Global adjustTime function - exact same as used in Route Stations
function adjustTime(timeStr, delayMinutes, showFullDate = false) {
    if (!timeStr || timeStr === '--:--') return '--:--';
    
    try {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes + (delayMinutes || 0);
        
        // Handle day rollover
        let finalHours = Math.floor(totalMinutes / 60) % 24;
        let finalMinutes = totalMinutes % 60;
        
        if (totalMinutes < 0) {
            finalHours = 24 + finalHours;
        }
        
        if (showFullDate) {
            return `Oct 22, ${String(finalHours).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}`;
        } else {
            return `${String(finalHours).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}`;
        }
    } catch (error) {
        return timeStr;
    }
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
            return date.toLocaleTimeString('en-PK', { 
                timeZone: 'Asia/Karachi',
                hour: '2-digit', 
                minute: '2-digit', 
                hour12: false // 24-hour format like TrackyourTrains
            });
        }
        
        // Otherwise try to parse as full date
        const date = new Date(timeString);
        if (isNaN(date.getTime())) {
            return timeString; // Return original if invalid
        }
        return date.toLocaleTimeString('en-PK', { 
            timeZone: 'Asia/Karachi',
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: false // 24-hour format like TrackyourTrains
        });
    } catch (e) {
        return timeString;
    }
}

// Cache for train schedule data to avoid repeated API calls
const scheduleCache = new Map();

async function fetchTrainSchedule(trainNumber) {
    if (scheduleCache.has(trainNumber)) {
        return scheduleCache.get(trainNumber);
    }
    
    try {
        const response = await fetch(`/api/train/${trainNumber}`);
        const data = await response.json();
        
        if (data.success && data.data && data.data.schedule) {
            scheduleCache.set(trainNumber, data.data.schedule);
            return data.data.schedule;
        }
    } catch (error) {
        console.error('Error fetching schedule for train', trainNumber, error);
    }
    
    return null;
}

async function fetchActiveTrains() {
    try {
        const response = await fetch(getAPIUrl('live'));
        const data = await response.json();
        
        if (data.success) {
            trainData.active = data.data;
            await displayActiveTrains(data.data);
            updateInfoBar(data.count || data.data.length, data.lastUpdated);
        }
    } catch (error) {
        console.error('Error fetching active trains:', error);
        document.getElementById('activeTrains').innerHTML = 
            '<p class="empty-state">Error loading train data. Please try again later.</p>';
    }
}

async function fetchSchedule() {
    try {
        const response = await fetch(getAPIUrl('schedule'));
        const data = await response.json();
        
        if (data.success) {
            trainData.schedule = data.data;
            displaySchedule(data.data);
        }
    } catch (error) {
        console.error('Error fetching schedule:', error);
        document.getElementById('scheduleList').innerHTML = 
            '<p class="empty-state">Error loading schedule. Please try again later.</p>';
    }
}

async function displayActiveTrains(trains) {
    const container = document.getElementById('activeTrains');
    
    if (!trains || trains.length === 0) {
        container.innerHTML = '<p class="empty-state">No active trains at the moment. Waiting for live data...</p>';
        return;
    }
    
    // Show loading state first
    container.innerHTML = '<p class="empty-state">Loading train details...</p>';
    
    // Process trains with schedule data
    const trainCards = await Promise.all(trains.map(async (train) => {
        // Extract relevant information from the live train data
        const trainNumber = train.TrainNumber || train.trainNumber || train.InnerKey || 'N/A';
        const trainName = train.TrainName || train.trainName || `Train ${trainNumber}`;
        const lateBy = train.LateBy || 0;
        // Helper function to format minutes into hours and minutes
        const formatMinutes = (minutes) => {
            if (!minutes || minutes === 0) return '0 min';
            const hours = Math.floor(Math.abs(minutes) / 60);
            const mins = Math.abs(minutes) % 60;
            if (hours > 0) {
                return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
            }
            return `${mins}min`;
        };
        
        // Helper function to format time in AM/PM
        const formatTime = (timeString) => {
            if (!timeString || timeString === 'N/A') return 'N/A';
            try {
                // Check if it's a time-only string (HH:MM format)
                if (timeString.match(/^\d{1,2}:\d{2}$/)) {
                    const [hours, minutes] = timeString.split(':').map(Number);
                    const date = new Date();
                    date.setHours(hours, minutes, 0, 0);
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
        };
        
        const status = lateBy > 0 ? `Late by ${formatMinutes(lateBy)}` : lateBy < 0 ? `Early by ${formatMinutes(lateBy)}` : 'On time';
        const speed = train.Speed !== undefined ? `${train.Speed} km/h` : 'N/A';
        const nextStation = train.NextStation || train.nextStation || 'N/A';
        
        // Find next station's arrival time from schedule data (same logic as Route Stations)
        let nextStationArrivalTime = train.NextStationETA; // fallback
        if (train.TrainNumber && train.NextStation) {
            const scheduleData = await fetchTrainSchedule(train.TrainNumber);
            if (scheduleData && scheduleData.length > 0) {
                const nextStationData = scheduleData.find(station => 
                    station.StationName === train.NextStation || 
                    station.StationName.includes(train.NextStation) ||
                    train.NextStation.includes(station.StationName)
                );
                if (nextStationData) {
                    nextStationArrivalTime = nextStationData.ArrivalTime || nextStationData.DepartureTime;
                }
            }
        }
        
        const eta = adjustTime(nextStationArrivalTime, lateBy) || 'N/A';
        const lastUpdate = train.LastUpdated ? formatTime(train.LastUpdated) : 'N/A';
        const locomotive = train.LocomotiveNumber || 'N/A';
        
        // Extract train date from LastUpdated field
        const getTrainDate = (lastUpdated) => {
            if (!lastUpdated) return new Date().toLocaleDateString();
            
            try {
                const date = new Date(lastUpdated);
                return date.toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: '2-digit', 
                    year: 'numeric'
                });
            } catch (e) {
                return new Date().toLocaleDateString();
            }
        };
        
        const trainDate = getTrainDate(train.LastUpdated);
        
        // Determine movement status
        const currentSpeed = train.Speed || 0;
        const movementStatus = currentSpeed > 0 ? 'Moving' : 'Stopped';
        const movementClass = currentSpeed > 0 ? 'status-moving' : 'status-stopped';
        
        // For live trains, go directly to train detail page using InnerKey
        const clickHandler = train.IsLive ? 
            `window.location.href = '/train.html?id=${train.InnerKey || trainNumber}'` : 
            `showTrainDetails('${trainNumber}')`;
        
        return `
        <div class="train-card" onclick="${clickHandler}" style="cursor: pointer;">
            <div class="train-number">${trainNumber}</div>
            <div class="train-name">${trainName}</div>
            <div class="train-info">
                <div class="info-row">
                    <span class="info-label">Status:</span>
                    <span class="status-badge ${status === 'On time' ? 'status-on-time' : lateBy > 0 ? 'status-delayed' : 'status-running'}">${status}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Train Date:</span>
                    <span class="train-date">${trainDate}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Movement:</span>
                    <span class="status-badge ${movementClass}">${movementStatus}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Speed:</span>
                    <span>${speed}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Next Station:</span>
                    <span>${nextStation}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">ETA:</span>
                    <span>${eta}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Locomotive:</span>
                    <span>${locomotive}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Last Update:</span>
                    <span>${lastUpdate}</span>
                </div>
            </div>
        </div>
        `;
    }));
    
    // Display all train cards
    container.innerHTML = trainCards.join('');
}

function displaySchedule(schedules) {
    const container = document.getElementById('scheduleList');
    
    if (!schedules || schedules.length === 0) {
        container.innerHTML = '<p class="empty-state">No schedule data available.</p>';
        return;
    }
    
    container.innerHTML = schedules.map(schedule => {
        // Get first and last station from the schedule
        const firstStation = schedule.stations && schedule.stations[0];
        const lastStation = schedule.stations && schedule.stations[schedule.stations.length - 1];
        const origin = firstStation ? (firstStation.StationName || firstStation.stationName || 'N/A') : 'N/A';
        const destination = lastStation ? (lastStation.StationName || lastStation.stationName || 'N/A') : 'N/A';
        const departure = firstStation ? formatTime(firstStation.DepartureTime || firstStation.Departure || firstStation.Arrival) || 'N/A' : 'N/A';
        const arrival = lastStation ? formatTime(lastStation.DepartureTime || lastStation.Arrival || lastStation.Departure) || 'N/A' : 'N/A';
        
        const trainNumber = schedule.trainNumber || 'N/A';
        const trainName = schedule.trainName || 'Unknown Train';
        
        const clickHandler = (trainNumber && trainNumber !== 'N/A') ? 
            `onclick="showTrainDetails('${trainNumber}')"` : 
            `style="cursor: not-allowed; opacity: 0.6;" title="Train details not available"`;
        
        return `
        <div class="schedule-item" ${clickHandler}>
            <div class="schedule-left">
                <div class="train-number">${trainNumber}</div>
                <div class="train-name">${trainName}</div>
                <div style="margin-top: 10px; color: #666;">
                    ${origin} → ${destination}
                </div>
                <div style="margin-top: 5px; color: #999; font-size: 12px;">
                    ${schedule.stations ? schedule.stations.length : 0} stations
                </div>
            </div>
            <div class="schedule-right">
                <div style="font-size: 14px; color: #999;">Departure</div>
                <div style="font-size: 20px; font-weight: bold; color: #333;">${departure}</div>
                <div style="font-size: 14px; color: #999; margin-top: 5px;">Arrival</div>
                <div style="font-size: 20px; font-weight: bold; color: #333;">${arrival}</div>
            </div>
        </div>
    `}).join('');
}

function getStatusClass(status) {
    if (!status) return 'status-running';
    const statusLower = status.toLowerCase();
    if (statusLower.includes('on time')) return 'status-on-time';
    if (statusLower.includes('delay')) return 'status-delayed';
    return 'status-running';
}

function updateInfoBar(count, lastUpdated) {
    document.getElementById('trainCount').textContent = `${count} active trains`;
    if (lastUpdated) {
        const date = new Date(lastUpdated);
        const timeString = date.toLocaleTimeString([], { 
            hour: 'numeric', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: true 
        });
        document.getElementById('lastUpdated').textContent = `Last updated: ${timeString}`;
    }
}

function switchTab(tabName) {
    currentTab = tabName;
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    event.target.classList.add('active');
    document.getElementById(`${tabName}Tab`).classList.add('active');
    
    if (tabName === 'schedule' && trainData.schedule.length === 0) {
        fetchSchedule();
    }
}

async function searchTrains() {
    const query = document.getElementById('searchInput').value.trim();
    console.log('Search called with query:', query, 'Current tab:', currentTab);
    
    if (!query) {
        // Clear search - show original data in current tab
        console.log('Clearing search, showing original data');
        if (currentTab === 'live') {
            displayActiveTrains(trainData.active);
        } else if (currentTab === 'schedule') {
            displaySchedule(trainData.schedule);
        }
        return;
    }
    
    const searchQuery = query.toLowerCase();
    console.log('Searching for:', searchQuery);
    
    if (currentTab === 'live') {
        // Filter live trains
        console.log('Live trains data:', trainData.active.length, 'trains');
        const filteredLive = trainData.active.filter(train => {
            const trainNumber = String(train.TrainNumber || train.trainNumber || '').toLowerCase();
            const trainName = String(train.TrainName || train.trainName || '').toLowerCase();
            const matches = trainNumber.includes(searchQuery) || trainName.includes(searchQuery);
            if (matches) {
                console.log('Found match:', trainName, trainNumber);
            }
            return matches;
        });
        console.log('Filtered results:', filteredLive.length, 'trains');
        displayActiveTrains(filteredLive);
        
    } else if (currentTab === 'schedule') {
        // Filter schedule data
        const filteredSchedule = trainData.schedule.filter(schedule => {
            const trainNumber = String(schedule.trainNumber || '').toLowerCase();
            const trainName = String(schedule.trainName || '').toLowerCase();
            return trainNumber.includes(searchQuery) || trainName.includes(searchQuery);
        });
        displaySchedule(filteredSchedule);
        
    } else {
        // For other tabs, use the original search functionality
        try {
            const response = await fetch(`${getAPIUrl('search')}?query=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            if (data.success) {
                trainData.searchResults = data.data;
                displaySearchResults(data.data);
                
                document.querySelectorAll('.tab-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                
                document.querySelectorAll('.tab-btn')[2].classList.add('active');
                document.getElementById('searchTab').classList.add('active');
            }
        } catch (error) {
            console.error('Error searching trains:', error);
            alert('Error searching trains. Please try again.');
        }
    }
}

function displaySearchResults(trains) {
    const container = document.getElementById('searchResults');
    
    if (!trains || trains.length === 0) {
        container.innerHTML = '<p class="empty-state">No trains found matching your search.</p>';
        return;
    }
    
    container.innerHTML = trains.map(train => {
        const trainNumber = train.TrainNumber || train.trainNumber || 'N/A';
        const trainName = train.TrainName || train.trainName || 'Unknown Train';
        const isLive = train.IsLive ? 'Live' : 'Scheduled';
        const description = train.TrainDescription || '';
        
        return `
        <div class="train-card" onclick="showTrainDetails('${trainNumber}')">
            <div class="train-number">${trainNumber}</div>
            <div class="train-name">${trainName}</div>
            <div class="train-info">
                <div class="info-row">
                    <span class="info-label">Status:</span>
                    <span class="status-badge ${isLive === 'Live' ? 'status-running' : 'status-on-time'}">${isLive}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Route:</span>
                    <span style="font-size: 12px;">${description || 'N/A'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Direction:</span>
                    <span>${train.IsUp ? 'Up' : 'Down'}</span>
                </div>
            </div>
        </div>
    `}).join('');
}

// selectTrainInstance function removed - no longer needed since we go directly to train page

async function showTrainDetails(trainIdentifier) {
    // Safety check for trainIdentifier
    if (!trainIdentifier || trainIdentifier === 'undefined' || trainIdentifier === 'null') {
        console.error('Invalid train identifier:', trainIdentifier);
        return;
    }
    
    const modal = document.getElementById('trainModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    // Safety check for modal elements
    if (!modal || !modalTitle || !modalBody) {
        console.error('Modal elements not found');
        return;
    }
    
    modal.style.display = 'block';
    modalTitle.textContent = `Train ${trainIdentifier} Details`;
    modalBody.innerHTML = '<div class="loading">Loading details...</div>';
    
    try {
        console.log('Fetching train details for:', trainIdentifier);
        const response = await fetch(getAPIUrl('train') + `/${trainIdentifier}`);
        const data = await response.json();
        
        console.log('Train details API response:', data);
        
        if (data.success && data.data) {
            const train = data.data;
            const schedule = data.data.schedule || [];
            
            modalTitle.textContent = `${train.TrainName || train.TrainNumber} Details`;
            
            // Find the most recent live instance of this train
            const liveInstance = findLiveTrainInstance(train.TrainNumber);
            
            modalBody.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <h3>${train.TrainName || 'Unknown Train'}</h3>
                    <p style="color: #666; margin-top: 5px;">Train Number: ${train.TrainNumber || trainIdentifier}</p>
                    <p style="color: #666;">Route: ${train.TrainDescription || 'N/A'}</p>
                    <p style="color: #666;">Status: ${liveInstance ? 'Live' : 'Scheduled'}</p>
                    <p style="color: #666;">Direction: ${train.IsUp ? 'Up' : 'Down'}</p>
                    
                    ${liveInstance ? `
                        <div style="margin-top: 15px;">
                            <button onclick="trackLiveTrain('${liveInstance.InnerKey}')" style="
                                background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
                                color: white;
                                border: none;
                                padding: 10px 20px;
                                border-radius: 25px;
                                cursor: pointer;
                                font-weight: bold;
                                font-size: 14px;
                                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
                                transition: all 0.3s;
                                margin-right: 10px;
                            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 20px rgba(0, 0, 0, 0.3)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 10px rgba(0, 0, 0, 0.2)';">
                                🚂 Track Live Train
                            </button>
                            <span style="color: #48bb78; font-size: 12px; font-weight: bold;">
                                ● LIVE NOW - Speed: ${liveInstance.Speed} km/h
                            </span>
                        </div>
                    ` : `
                        <div style="margin-top: 15px;">
                            <span style="color: #999; font-size: 12px;">
                                ⚪ No live instances currently running
                            </span>
                        </div>
                    `}
                </div>
                
                ${schedule && schedule.length > 0 ? `
                    <h4 style="margin-bottom: 15px;">Route Information (${schedule.length} stations)</h4>
                    <table class="route-table">
                        <thead>
                            <tr>
                                <th>Station</th>
                                <th>Arrival</th>
                                <th>Departure</th>
                                <th>Stop #</th>
                                <th>Day</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${schedule.map(station => `
                                <tr>
                                    <td>${station.StationName || 'N/A'}</td>
                                    <td>${formatTime(station.ArrivalTime) || formatTime(station.DepartureTime) || '--'}</td>
                                    <td>${formatTime(station.DepartureTime) || '--'}</td>
                                    <td>${station.OrderNumber || '--'}</td>
                                    <td>${station.IsDayChanged ? '+' + station.DayCount : '1'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : '<p style="color: #999;">No route information available.</p>'}
            `;
        } else {
            modalTitle.textContent = `Train ${trainIdentifier} - No Data`;
            modalBody.innerHTML = `
                <div style="text-align: center; padding: 40px 20px;">
                    <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                    <h3 style="color: #666; margin-bottom: 15px;">Unable to load train details</h3>
                    <p style="color: #999;">Train ${trainIdentifier} may not be in our database or the data is currently unavailable.</p>
                    <p style="color: #999; margin-top: 10px;">This could happen if:</p>
                    <ul style="color: #999; text-align: left; max-width: 300px; margin: 20px auto;">
                        <li>The train number is incorrect</li>
                        <li>The train is not currently scheduled</li>
                        <li>Data is temporarily unavailable</li>
                    </ul>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error fetching train details:', error);
        modalTitle.textContent = `Train ${trainIdentifier} - Error`;
        modalBody.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 48px; margin-bottom: 20px;">❌</div>
                <h3 style="color: #666; margin-bottom: 15px;">Error loading train details</h3>
                <p style="color: #999;">There was a network error while trying to fetch train information.</p>
                <p style="color: #999; margin-top: 10px;">Please check your connection and try again.</p>
                <button onclick="showTrainDetails('${trainIdentifier}')" style="
                    margin-top: 20px;
                    padding: 10px 20px;
                    background: #667eea;
                    color: white;
                    border: none;
                    border-radius: 25px;
                    cursor: pointer;
                    font-size: 14px;
                ">Try Again</button>
            </div>
        `;
    }
}


async function refreshData() {
    const btn = event.target;
    btn.disabled = true;
    btn.textContent = 'Refreshing...';
    
    try {
        const response = await fetch('/api/refresh');
        const data = await response.json();
        
        if (data.success) {
            await fetchActiveTrains();
            if (currentTab === 'schedule') {
                await fetchSchedule();
            }
            console.log('Data refreshed successfully!');
        }
    } catch (error) {
        console.error('Error refreshing data:', error);
        alert('Error refreshing data. Please try again.');
    } finally {
        btn.disabled = false;
        btn.textContent = '↻ Refresh';
    }
}

document.getElementById('searchInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        searchTrains();
    }
});


// Helper function to find live train instance
function findLiveTrainInstance(trainNumber) {
    if (!trainData.active || trainData.active.length === 0) return null;
    
    // Find all live instances of this train number
    const liveInstances = trainData.active.filter(train => 
        String(train.TrainNumber) === String(trainNumber) &&
        train.IsLive &&
        train.Speed !== undefined
    );
    
    if (liveInstances.length === 0) return null;
    
    // Return the most recent one (by last updated time)
    return liveInstances.sort((a, b) => 
        new Date(b.LastUpdated) - new Date(a.LastUpdated)
    )[0];
}

// Function to open live train tracking page
function trackLiveTrain(innerKey) {
    window.open(`/train.html?id=${innerKey}`, '_blank');
}

// Modal functions
function closeModal() {
    const modal = document.getElementById('trainModal');
    modal.style.display = 'none';
}

// Close modal when clicking outside of it
window.onclick = function(event) {
    const modal = document.getElementById('trainModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}

// Close modal with Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const modal = document.getElementById('trainModal');
        if (modal.style.display === 'block') {
            modal.style.display = 'none';
        }
    }
});

document.addEventListener('DOMContentLoaded', function() {
    fetchActiveTrains();
    
    setInterval(() => {
        if (currentTab === 'live') {
            fetchActiveTrains();
        }
    }, 300000);
});