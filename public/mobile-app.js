// Simple Mobile Train Tracker App
class MobileApp {
    constructor() {
        this.currentScreen = 'home';
        this.screens = ['home', 'liveTracking', 'station', 'trainDetails', 'map'];
        this.trainData = { active: [] };
        this.currentTrainData = null;
        this.userLocation = null;
        this.nearestStation = null;
        this.favoriteTrains = this.loadFavoritesFromStorage();
        this.isLiveSearchActive = false;
        this.detailRefreshInterval = null;
        this.progressBarInterval = null;
        this.trainDetailClockInterval = null;
        this.currentRouteStations = null;
        this.lastUpdatedTime = null;
        this.navigationStack = ['home']; // Track navigation history
        this.homeLastUpdatedTime = null;
        this.liveTrackingLastUpdatedTime = null;
        this.scheduleLastUpdatedTime = null;
        this.trainDetailLastUpdatedTime = null;
        
        // Map-related properties
        this.map = null;
        this.trainMarkers = [];
        this.routeLines = [];
        this.selectedTrain = null;
        this.mapRefreshInterval = null;
        
        // Notification properties
        this.notifications = this.loadNotificationsFromStorage();
        this.notificationCheckInterval = null;
        
        // Progress bar update control
        this.progressBarUpdateInterval = null;
        
        this.init();
    }

    async init() {
        console.log('🚂 Mobile Train Tracker initialized');
        
        // Ensure body has correct classes
        document.body.classList.add('mobile-app');
        document.body.classList.remove('screen-active');
        this.currentScreen = 'home';
        
        // Make sure main content is visible
        this.showMainContent();
        
        // Check notification permission (don't request - will be requested when user sets up a notification)
        if ('Notification' in window) {
            console.log(`🔔 Notification permission: ${Notification.permission}`);
            
            // Start notification monitoring (only if permission already granted)
            if (Notification.permission === 'granted') {
                this.startNotificationMonitoring();
            }
        }
        
        // Load schedule data FIRST (needed for filtering completed journeys)
        await this.loadScheduledTrainsForHome();
        
        // Then load live trains data for home screen (after schedule is available)
        // MUST await to ensure trainData.active is populated before loadLiveUpdates()
        await this.loadLiveTrains();
        
        // Request user location
        this.getUserLocation();
        
        // Start live updates feed (now trainData.active is guaranteed to be populated)
        this.loadLiveUpdates();
        
        this.setupNavigation();
        this.setupHistoryNavigation();
        this.initializeDarkMode();
        this.startAutoRefresh();
        this.startLastUpdatedCountdown();
    }

    setupNavigation() {
        // Handle navigation clicks
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const screen = e.currentTarget.getAttribute('onclick')?.match(/navigateTo\('(.+)'\)/)?.[1];
                if (screen) {
                    this.navigateTo(screen);
                }
            });
        });
    }

    setupHistoryNavigation() {
        // Set initial history state
        if (!history.state) {
            history.replaceState({ screen: 'home' }, '', '#home');
        }

        // Handle browser back/forward buttons AND iOS swipe-back gesture
        window.addEventListener('popstate', (event) => {
            console.log('🔙 Browser/iOS back gesture detected', event.state);
            console.log('📚 Current navigation stack before popstate:', this.navigationStack);
            
            if (event.state && event.state.screen) {
                const targetScreen = event.state.screen;
                
                // Sync navigation stack with browser history
                // Remove screens after the target screen from the stack
                const targetIndex = this.navigationStack.indexOf(targetScreen);
                if (targetIndex !== -1) {
                    // Found the screen in stack - remove everything after it
                    this.navigationStack = this.navigationStack.slice(0, targetIndex + 1);
                    console.log('📚 Synced navigation stack:', this.navigationStack);
                } else {
                    // Not in stack - add it (shouldn't normally happen)
                    this.navigationStack.push(targetScreen);
                    console.log('📚 Added missing screen to stack:', this.navigationStack);
                }
                
                this.navigateToScreen(targetScreen, false);
            } else {
                // No state - go to home and reset stack
                this.navigationStack = ['home'];
                console.log('📚 Reset navigation stack to home');
                this.navigateToScreen('home', false);
            }
        });

        // Prevent default back button behavior on Android
        document.addEventListener('backbutton', (e) => {
            e.preventDefault();
            this.goBack();
        }, false);

        // Handle escape key for web browsers
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                console.log('🔙 Escape key pressed');
                this.goBack();
            }
        });
    }

    navigateTo(screen, data = null) {
        console.log('🔄 Navigating to:', screen);
        
        // Update active nav item
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        
        switch(screen) {
            case 'home':
                document.querySelectorAll('.nav-item')[0].classList.add('active');
                this.goBack();
                break;
            case 'track':
                document.querySelectorAll('.nav-item')[1].classList.add('active');
                this.openMostRecentTrain();
                break;
            case 'search':
                document.querySelectorAll('.nav-item')[2].classList.add('active');
                this.navigateToScreen('trainSearchScreen');
                break;
            case 'favorites':
                document.querySelectorAll('.nav-item')[3].classList.add('active');
                this.navigateToScreen('favoritesScreen');
                // loadFavorites is called by loadScreenData
                break;
            case 'profile':
                document.querySelectorAll('.nav-item')[4].classList.add('active');
                this.navigateToScreen('profileScreen');
                this.loadProfile();
                break;
        }
    }

    // Main screen navigation function
    navigateToScreen(screenId, pushHistory = true) {
        console.log('🔄 Navigating to screen:', screenId);

        // Store previous screen
        const previousScreen = this.currentScreen;

        // Stop auto-refresh if leaving train detail screen
        if (this.currentScreen === 'liveTrainDetail' && screenId !== 'liveTrainDetail') {
            this.stopDetailAutoRefresh();
        }

        this.currentScreen = screenId;

        // Push to navigation stack
        if (pushHistory && this.navigationStack[this.navigationStack.length - 1] !== screenId) {
            this.navigationStack.push(screenId);
            const url = screenId === 'home' ? '#home' : `#${screenId}`;
            history.pushState({ screen: screenId, previous: previousScreen }, '', url);
            console.log('📚 Navigation stack:', this.navigationStack);
        } else if (!pushHistory) {
            // Don't add to stack if it's a back navigation
            console.log('📚 Back navigation - not adding to stack');
        }

        // Special case for home/dashboard
        if (screenId === 'home' || screenId === 'dashboard') {
            this.showMainContent();
            return;
        }

        // Hide main content and show screen
        this.hideMainContent();
        
        // Hide all screens first
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
            screen.classList.add('hidden');
        });
        
        // Show target screen
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            console.log(`✅ Found target screen: ${screenId}`);
            targetScreen.classList.remove('hidden');
            targetScreen.classList.add('active');
            
            // Update navigation
            this.updateNavigation(screenId);
            
            // Load screen data
            this.loadScreenData(screenId);
        } else {
            console.error(`❌ Screen ${screenId} not found! Available screens:`, 
                Array.from(document.querySelectorAll('.screen')).map(s => s.id));
        }
    }

    // Hide main content when showing screens
    hideMainContent() {
        const mainContent = document.querySelector('.main-content');
        const mobileFooter = document.querySelector('.mobile-footer');
        const quickMenu = document.querySelector('.quick-menu');
        
        if (mainContent) mainContent.style.display = 'none';
        if (mobileFooter) mobileFooter.style.display = 'none';
        if (quickMenu) quickMenu.style.display = 'none';
        
        document.body.classList.add('screen-active');
    }

    // Show main content when returning to home
    showMainContent() {
        console.log('🏠 Showing main content/home screen');
        
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
            screen.classList.add('hidden');
        });
        
        // Show main content - force display and remove any hiding styles
        const mainContent = document.querySelector('.main-content');
        const mobileFooter = document.querySelector('.mobile-footer');
        const quickMenu = document.querySelector('.quick-menu');
        const floatingHeader = document.querySelector('.floating-header');
        
        if (mainContent) {
            mainContent.style.display = 'block';
            mainContent.style.visibility = 'visible';
            mainContent.style.opacity = '1';
        }
        if (mobileFooter) {
            mobileFooter.style.display = 'block';
            mobileFooter.style.visibility = 'visible';
        }
        if (quickMenu) {
            quickMenu.style.display = 'flex';
            quickMenu.style.visibility = 'visible';
        }
        if (floatingHeader) {
            floatingHeader.style.display = 'block';
            floatingHeader.style.visibility = 'visible';
        }
        
        document.body.classList.remove('screen-active');
        this.currentScreen = 'home';
        
        // Debug: Check body classes
        console.log('🏠 Body classes after showing home:', document.body.className);
        console.log('🏠 Main content display:', window.getComputedStyle(document.querySelector('.main-content')).display);
        
        // Update navigation
        this.updateNavigation('home');
        
        // Refresh home screen data immediately
        setTimeout(() => {
            this.refreshHomeScreenData();
        }, 100); // Small delay to ensure DOM is ready
    }
    
    // Refresh home screen data
    refreshHomeScreenData() {
        console.log('🔄 Refreshing home screen data...');
        
        // Refresh live trains
        if (this.trainData && this.trainData.active) {
            this.populateLiveTrains();
            this.updateActiveTrainsCount();
        }
        
        // Refresh live updates
        this.loadLiveUpdates();
    }


    goBack() {
        console.log('⬅️ Going back from:', this.currentScreen);
        console.log('📚 Navigation stack:', this.navigationStack);

        // Special handling for map screen - check if train info panel is open
        if (this.currentScreen === 'mapScreen') {
            const trainInfoPanel = document.getElementById('trainInfoPanel');
            if (trainInfoPanel && trainInfoPanel.classList.contains('show')) {
                // If train info panel is open, close it and show train list
                console.log('⬅️ Closing train info panel, showing train list');
                this.closeTrainInfo();
                this.showTrainSelectionPanel();
                return;
        } else {
                // If train list is showing, go back in navigation stack
                console.log('⬅️ From map screen, going back in stack');
                // Don't force home, use normal navigation
            }
        }

        // Special handling for train detail screens - go to live tracking
        if (this.currentScreen === 'liveTrainDetail') {
            console.log('⬅️ From train detail, going to live tracking');
            // Remove current screen from stack
            if (this.navigationStack.length > 1) {
                this.navigationStack.pop();
            }
            // Ensure we're going to the correct screen
            this.navigateToScreen('liveTracking', false);
            // Load live trains data when returning to live tracking
            setTimeout(() => {
                this.loadLiveTrains();
                this.populateLiveTrackingScreen();
            }, 100);
            return;
        }

        // Special handling for schedule details - go to schedule
        if (this.currentScreen === 'scheduleDetailsScreen') {
            console.log('⬅️ From schedule details, going to schedule');
            // Remove current screen from stack first
            if (this.navigationStack.length > 1) {
                this.navigationStack.pop();
            }
            this.navigateToScreen('scheduleScreen', false);
            return;
        }

        // Remove current screen from stack
        if (this.navigationStack.length > 1) {
            this.navigationStack.pop(); // Remove current screen
            const previousScreen = this.navigationStack[this.navigationStack.length - 1];
            console.log('⬅️ Navigating to previous screen:', previousScreen);
            this.navigateToScreen(previousScreen, false);
        } else {
            // Fallback to home if no previous screens
            console.log('⬅️ No previous screens, going to home');
            this.navigateToScreen('home', false);
        }
    }

    showLiveTracking() {
        this.navigateToScreen('liveTracking');
        this.loadLiveTrains();
        
        // Use a timeout to ensure data is loaded before populating tracking screen
        setTimeout(() => {
            this.populateLiveTrackingScreen();
            this.initializeLiveTrackingSearch();
        }, 100);
    }

    openMostRecentTrain() {
        if (!this.trainData.active || this.trainData.active.length === 0) {
            // If no live data, show live tracking screen
            this.showLiveTracking();
            return;
        }

        // Find the most recent train (highest speed or latest update)
        let mostRecentTrain = this.trainData.active[0];
        
        // Prefer trains with higher speeds (actively moving)
        for (const train of this.trainData.active) {
            const speed = train.Speed || 0;
            const currentSpeed = mostRecentTrain.Speed || 0;
            
            if (speed > currentSpeed || 
                (speed === currentSpeed && train.LateBy < (mostRecentTrain.LateBy || 0))) {
                mostRecentTrain = train;
            }
        }

        const trainId = mostRecentTrain.InnerKey || mostRecentTrain.TrainId || mostRecentTrain.TrainNumber;
        console.log('🚂 Opening most recent active train:', trainId, mostRecentTrain.TrainName);
        this.openTrainDetails(trainId);
    }

    showMap() {
        this.navigateToScreen('mapScreen');
        this.initializeMap();
    }

    async loadLiveTrains() {
        try {
            const startTime = Date.now();
            const liveUrl = getAPIUrl('live');
            console.log('🚂 [LIVE DATA] Loading live trains...');
            console.log('🚂 [LIVE DATA] Source URL:', liveUrl);
            console.log('🚂 [LIVE DATA] Full URL:', liveUrl);
            
            const response = await fetch(liveUrl);
            console.log('🚂 [LIVE DATA] Response status:', response.status, response.statusText);
            console.log('🚂 [LIVE DATA] Response headers:', {
                'content-type': response.headers.get('content-type'),
                'content-length': response.headers.get('content-length')
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            const loadTime = Date.now() - startTime;
            console.log('✅ [LIVE DATA] SUCCESS - Live trains loaded');
            console.log('✅ [LIVE DATA] Load time:', loadTime, 'ms');
            console.log('✅ [LIVE DATA] Response:', { success: data.success, dataLength: data.data?.length });
            console.log('✅ [LIVE DATA] Data size:', (JSON.stringify(data).length / 1024).toFixed(2), 'KB');
            
            if (data.success && data.data && data.data.length > 0) {
                // Filter to keep only top 2 most recent instances per train number
                let filteredTrains = this.filterDuplicateTrains(data.data);
                
                // Further filter out trains that reached destination and stopped for 30+ minutes
                filteredTrains = this.filterCompletedJourneys(filteredTrains);
                
                // Filter out trains with unrealistic delays (24+ hours)
                filteredTrains = this.filterUnrealisticDelays(filteredTrains);
                
                this.trainData.active = filteredTrains;
                console.log('✅ Live trains loaded and filtered:', filteredTrains.length, 'trains (from', data.data.length, 'total)');
                this.populateLiveTrains();
                this.updateActiveTrainsCount();
                this.initializeLiveTrackingSearch();
            } else {
                console.log('⚠️ No live train data available, showing sample data');
                this.loadSampleData();
                this.initializeLiveTrackingSearch();
            }
        } catch (error) {
            console.error('❌ Error loading live trains:', error);
            console.log('🔄 Loading sample data as fallback');
            this.loadSampleData();
            this.initializeLiveTrackingSearch();
        }
    }

    // Filter duplicate train instances - keep only trains from last 2 dates per train number/direction
    filterDuplicateTrains(trains) {
        console.log('🔍 Filtering duplicate train instances by date...');
        console.log('📊 Total trains from API:', trains.length);
        
        // First, filter out trains not matching last 3 dates
        const trainsWithValidDates = this.filterByRecentDates(trains, 3);
        
        // Group trains by train number AND direction (UP/DN)
        const trainsByNumberAndDirection = {};
        const seenKeys = []; // Track order of first appearance
        
        trainsWithValidDates.forEach(train => {
            const trainNumber = String(train.TrainNumber);
            const trainName = train.TrainName || '';
            
            // Determine direction from train name (UP/DN suffix)
            let direction = 'UP'; // default
            if (trainName.includes('DN') || trainName.includes('DOWN') || trainName.includes('Down')) {
                direction = 'DN';
            } else if (trainName.includes('UP') || trainName.includes('Up')) {
                direction = 'UP';
            }
            
            const key = `${trainNumber}_${direction}`;
            
            if (!trainsByNumberAndDirection[key]) {
                trainsByNumberAndDirection[key] = [];
                seenKeys.push(key); // Track order of first appearance
            }
            trainsByNumberAndDirection[key].push(train);
        });
        
        // For each train number + direction, keep only the latest 2 DATES
        const filteredTrains = [];
        
        seenKeys.forEach(key => {
            const instances = trainsByNumberAndDirection[key];
            const [trainNumber, direction] = key.split('_');
            
            // Group by date
            const instancesByDate = {};
            instances.forEach(train => {
                const dateInfo = this.extractDateFromInnerKey(train.InnerKey, train.TrainNumber);
                if (dateInfo) {
                    const dateKey = dateInfo.sortKey;
                    if (!instancesByDate[dateKey]) {
                        instancesByDate[dateKey] = [];
                    }
                    instancesByDate[dateKey].push(train);
                }
            });
            
            // Sort dates descending (most recent first) and keep top 2 dates
            const sortedDates = Object.keys(instancesByDate).sort((a, b) => b.localeCompare(a));
            const latestTwoDates = sortedDates.slice(0, 2);
            
            console.log(`🚂 Train #${trainNumber} ${direction} (${instances[0]?.TrainName}): Found ${sortedDates.length} dates, keeping latest 2`);
            
            // Keep all instances from the latest 2 dates (but max 2 per date)
            latestTwoDates.forEach(dateKey => {
                const dateInstances = instancesByDate[dateKey];
                const kept = dateInstances.slice(0, 2); // Keep first 2 from this date
                
                const dateInfo = this.extractDateFromInnerKey(kept[0].InnerKey, kept[0].TrainNumber);
                console.log(`  📅 Date ${dateInfo.dateString}: ${kept.length} instance(s) kept`);
                
                filteredTrains.push(...kept);
            });
        });
        
        // Sort by train number, then by date (most recent first)
        filteredTrains.sort((a, b) => {
            // First sort by train number
            const trainNumA = parseInt(a.TrainNumber) || 0;
            const trainNumB = parseInt(b.TrainNumber) || 0;
            
            if (trainNumA !== trainNumB) {
                return trainNumA - trainNumB;
            }
            
            // If same train number, sort by date (most recent first)
            const dateA = this.extractDateFromInnerKey(a.InnerKey, a.TrainNumber);
            const dateB = this.extractDateFromInnerKey(b.InnerKey, b.TrainNumber);
            
            if (dateA && dateB) {
                return dateB.sortKey.localeCompare(dateA.sortKey); // Most recent first
            }
            
            return 0;
        });
        
        console.log(`📊 Filtered result: ${filteredTrains.length} trains from ${trains.length} total (removed ${trains.length - filteredTrains.length} duplicates)`);
        console.log(`📋 Kept InnerKeys (sorted by train# then date):`, filteredTrains.map(t => `${t.TrainNumber}:${t.InnerKey}`).join(', '));
        return filteredTrains;
    }

    // Filter trains to keep only those from the last N dates
    filterByRecentDates(trains, maxDays = 3) {
        console.log(`🗓️ Filtering trains to keep only last ${maxDays} dates...`);
        
        // Extract all unique dates from InnerKeys
        const datesSet = new Set();
        const trainsByDate = {};
        
        trains.forEach(train => {
            const dateInfo = this.extractDateFromInnerKey(train.InnerKey, train.TrainNumber);
            if (dateInfo) {
                const dateKey = dateInfo.sortKey;
                datesSet.add(dateKey);
                
                if (!trainsByDate[dateKey]) {
                    trainsByDate[dateKey] = [];
                }
                trainsByDate[dateKey].push(train);
            }
        });
        
        // Sort dates descending and get the last N dates
        const sortedDates = Array.from(datesSet).sort((a, b) => b.localeCompare(a));
        const recentDates = sortedDates.slice(0, maxDays);
        
        console.log(`📅 Found ${sortedDates.length} unique dates in data`);
        console.log(`✅ Keeping trains from dates: ${recentDates.map(d => {
            const y = d.slice(0, 4);
            const m = d.slice(4, 6);
            const day = d.slice(6, 8);
            return `${day}/${m}/${y}`;
        }).join(', ')}`);
        
        // Keep only trains from recent dates
        const filteredTrains = [];
        recentDates.forEach(dateKey => {
            filteredTrains.push(...trainsByDate[dateKey]);
        });
        
        const removedCount = trains.length - filteredTrains.length;
        if (removedCount > 0) {
            console.log(`🗑️ Filtered out ${removedCount} trains from older dates`);
        }
        
        return filteredTrains;
    }

    // Filter out trains that have reached destination and been stopped for 30+ minutes
    filterCompletedJourneys(trains) {
        console.log('🔍 Filtering completed journeys (destination reached, stopped, 30+ min old)...');
        
        // Check if schedule data is available
        if (!this.scheduleData || !Array.isArray(this.scheduleData) || this.scheduleData.length === 0) {
            console.log('⚠️ Schedule data not yet loaded, skipping destination filter (will apply on next refresh)');
            return trains; // Return all trains without filtering
        }
        
        console.log('✅ Schedule data available, checking destinations...');
        
        const now = new Date();
        const activeTrains = [];
        const filteredOutTrains = [];
        
        trains.forEach(train => {
            // Check all three conditions:
            // 1. Has reached destination (last station)
            // 2. Speed is 0 (stopped)
            // 3. Last updated more than 30 minutes ago
            
            const speed = train.Speed || train.SpeedKmph || 0;
            const lastUpdated = new Date(train.LastUpdated || train.__last_updated || train.last_updated || now);
            const minutesSinceUpdate = (now - lastUpdated) / 1000 / 60;
            
            // Check if train has reached destination
            const hasReachedDestination = this.hasTrainReachedDestination(train);
            
            const isStopped = speed === 0;
            const isOlderThan30Min = minutesSinceUpdate > 30;
            
            // All three conditions must be true to filter out
            if (hasReachedDestination && isStopped && isOlderThan30Min) {
                filteredOutTrains.push({
                    train,
                    reason: `Reached destination, stopped for ${Math.round(minutesSinceUpdate)}min`
                });
            } else {
                activeTrains.push(train);
            }
        });
        
        if (filteredOutTrains.length > 0) {
            console.log(`🏁 Filtered out ${filteredOutTrains.length} completed journeys:`);
            filteredOutTrains.forEach(({ train, reason }) => {
                console.log(`  ✗ ${train.TrainName} (${train.InnerKey}): ${reason}`);
            });
        }
        
        console.log(`✅ Active trains remaining: ${activeTrains.length}`);
        return activeTrains;
    }

    // Check if train has reached its destination (last station)
    hasTrainReachedDestination(train) {
        // If we don't have schedule data loaded yet, we can't determine this
        if (!this.scheduleData || !Array.isArray(this.scheduleData)) {
            return false;
        }

        const trainNumber = String(train.TrainNumber);
        
        // Find the train's schedule
        let scheduledTrain = this.scheduleData.find(t => 
            String(t.trainNumber) === trainNumber || 
            String(t.TrainNumber) === trainNumber
        );

        if (!scheduledTrain || !scheduledTrain.stations || scheduledTrain.stations.length === 0) {
            return false;
        }

        // Get the last station (destination) from schedule
        const lastStation = scheduledTrain.stations[scheduledTrain.stations.length - 1];
        const lastStationName = lastStation.StationName;
        
        // Get current/next station from live data
        const currentStation = train.NextStation || train.CurrentStation || train.LastStation || '';
        
        // Check if current station matches destination (case-insensitive, partial match)
        if (!currentStation || !lastStationName) {
            return false;
        }
        
        const hasReached = currentStation.toLowerCase().includes(lastStationName.toLowerCase()) ||
                          lastStationName.toLowerCase().includes(currentStation.toLowerCase());
        
        if (hasReached) {
            console.log(`🏁 Train ${train.TrainName} reached destination: ${lastStationName} (Current: ${currentStation})`);
        }
        
        return hasReached;
    }

    // Filter out trains with unrealistic delays (24+ hours = 1440+ minutes)
    filterUnrealisticDelays(trains) {
        console.log('🔍 Filtering trains with unrealistic delays (24+ hours)...');
        
        const activeTrains = [];
        const filteredOutTrains = [];
        const MAX_REALISTIC_DELAY = 1440; // 24 hours in minutes
        
        trains.forEach(train => {
            // Calculate delay from ETA if possible, otherwise use LateBy
            const calculatedDelay = this.calculateDelayFromETA(train);
            const delay = calculatedDelay !== null ? calculatedDelay : (train.LateBy || 0);
            
            const delayMinutes = Math.abs(delay); // Use absolute value
            
            if (delayMinutes >= MAX_REALISTIC_DELAY) {
                const delayHours = Math.floor(delayMinutes / 60);
                filteredOutTrains.push({
                    train,
                    delay: delayMinutes,
                    reason: `Unrealistic delay: ${delayHours}h (${delayMinutes}min)`
                });
            } else {
                activeTrains.push(train);
            }
        });
        
        if (filteredOutTrains.length > 0) {
            console.log(`⚠️ Filtered out ${filteredOutTrains.length} trains with unrealistic delays:`);
            filteredOutTrains.forEach(({ train, delay, reason }) => {
                console.log(`  ✗ ${train.TrainName} (${train.InnerKey}): ${reason}`);
            });
        }
        
        console.log(`✅ Trains with realistic delays remaining: ${activeTrains.length}`);
        return activeTrains;
    }
    
    // Load sample data for testing
    loadSampleData() {
        console.log('📝 Loading sample train data for testing...');
        
        this.trainData.active = [
            {
                InnerKey: 'SAMPLE001',
                TrainNumber: '15',
                TrainName: 'Karachi Express',
                Speed: 85,
                LateBy: 10,
                NextStation: 'Lahore Junction',
                Status: 'R',
                LastUpdated: new Date().toISOString()
            },
            {
                InnerKey: 'SAMPLE002', 
                TrainNumber: '42',
                TrainName: 'Green Line Express',
                Speed: 72,
                LateBy: 0,
                NextStation: 'Multan Cantt',
                Status: 'R',
                LastUpdated: new Date().toISOString()
            },
            {
                InnerKey: 'SAMPLE003',
                TrainNumber: '25',
                TrainName: 'Business Express',
                Speed: 0,
                LateBy: 25,
                NextStation: 'Rawalpindi',
                Status: 'A',
                LastUpdated: new Date().toISOString()
            }
        ];
        
        this.populateLiveTrains();
        this.updateActiveTrainsCount();
    }

    populateLiveTrains() {
        const container = document.getElementById('liveTrainsList');
        if (!container) {
            console.log('❌ Live trains container not found');
            return;
        }
        
        if (!this.trainData.active || this.trainData.active.length === 0) {
            container.innerHTML = '<div class="loading">No live trains available</div>';
            return;
        }
        
        console.log('🔄 Populating', this.trainData.active.length, 'live trains on home screen');

        let html = '';
        
        this.trainData.active.slice(0, 10).forEach(train => {
            const trainId = train.InnerKey || train.TrainId || train.TrainNumber;
            const trainNumber = String(train.TrainNumber);
            const trainName = train.TrainName || `Train ${train.TrainNumber}`;
            const speed = train.Speed || 0;

            // Calculate accurate delay from ETA
            const calculatedDelay = this.calculateDelayFromETA(train);
            const delay = calculatedDelay !== null ? calculatedDelay : (train.LateBy || 0);

            const location = train.NextStation || 'Location updating...';

            let statusBadge = 'LIVE';
            let badgeColor = '#10B981';

            if (delay > 15) {
                statusBadge = this.formatDelayDisplay(delay).replace(' Late', '');
                badgeColor = '#EF4444';
            } else if (delay > 5) {
                statusBadge = this.formatDelayDisplay(delay).replace(' Late', '');
                badgeColor = '#F59E0B';
            }

            // Calculate ETA for next station
            const eta = this.calculateTrainETA(train);

            // Get scheduled time for next station and format it
            const scheduledTime = this.getScheduledTimeForNextStation(train);
            const formattedScheduledTime = scheduledTime.replace('📅 ', '');
            const scheduledTimeAMPM = formattedScheduledTime !== 'Loading...' && formattedScheduledTime !== 'Schedule N/A'
                ? this.formatTimeAMPM(formattedScheduledTime)
                : formattedScheduledTime;

            // Get last updated time and train date
            const lastUpdated = this.formatLastUpdated(train.LastUpdated || train.__last_updated || train.last_updated);
            const trainDate = this.getTrainDate(train.LastUpdated || train.__last_updated || train.last_updated, train.InnerKey, train.TrainNumber);

            html += `
                <div class="train-card" onclick="mobileApp.openTrainDetails('${trainId}')">
                    <div class="train-card-header ${delay > 0 ? 'header-delayed' : 'header-ontime'}">
                        <div class="train-header-content">
                            <div class="train-name">${trainName}</div>
                        </div>
                        <button class="favorite-btn ${this.favoriteTrains.includes(trainNumber) ? 'favorited' : ''}" onclick="event.stopPropagation(); mobileApp.toggleFavorite('${trainNumber}')" title="${this.favoriteTrains.includes(trainNumber) ? 'Remove from favorites' : 'Add to favorites'}">
                            <span>${this.favoriteTrains.includes(trainNumber) ? '⭐' : '☆'}</span>
                        </button>
                    </div>
                    <div class="train-route">
                        <div class="train-number">#${train.TrainNumber}</div>
                        <div class="train-route-arrow">→</div>
                        <div class="next-station">${location}</div>
                    </div>
                    <div class="train-info-grid">
                        <div class="info-row">
                            <span class="info-icon">📍</span>
                            <span class="info-text">Next Station: ${location}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-icon">📅</span>
                            <span class="info-text">Scheduled: ${scheduledTimeAMPM}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-icon">⏱️</span>
                            <span class="info-text">Delay: ${delay > 0 ? this.formatDelayDisplay(delay) : 'On Time'}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-icon">⏰</span>
                            <span class="info-text">${eta}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-icon">⚡</span>
                            <span class="info-text">Speed: ${speed} km/h</span>
                        </div>
                        <div class="info-row">
                            <span class="info-icon">📅</span>
                            <span class="info-text">Train Date: ${trainDate}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-icon">🔄</span>
                            <span class="info-text">Updated: ${lastUpdated}</span>
                        </div>
                    </div>
                    <div class="train-status-row">
                        <div class="status-badge ${speed > 0 ? 'status-moving' : 'status-stopped'}">
                            ${speed > 0 ? 'Moving' : 'Stopped'}
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
        this.updateLiveStatistics();
        this.initializeCarouselDots();
        this.homeLastUpdatedTime = new Date();
    }

    initializeCarouselDots() {
        const carousel = document.getElementById('liveTrainsList');
        const dotsContainer = document.getElementById('carouselDots');

        if (!carousel || !dotsContainer) return;

        const cards = carousel.querySelectorAll('.train-card');
        if (cards.length === 0) return;

        // Create dots
        dotsContainer.innerHTML = '';
        cards.forEach((card, index) => {
            const dot = document.createElement('div');
            dot.className = 'carousel-dot';
            if (index === 0) dot.classList.add('active');

            dot.addEventListener('click', () => {
                card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
            });

            dotsContainer.appendChild(dot);
        });

        // Update active dot on scroll
        carousel.addEventListener('scroll', () => {
            const scrollLeft = carousel.scrollLeft;
            const cardWidth = cards[0].offsetWidth;
            const gap = 16;
            const activeIndex = Math.round(scrollLeft / (cardWidth + gap));

            const dots = dotsContainer.querySelectorAll('.carousel-dot');
            dots.forEach((dot, index) => {
                dot.classList.toggle('active', index === activeIndex);
            });
        });
    }

    updateLiveStatistics() {
        if (!this.trainData.active) return;
        
        const activeCount = this.trainData.active.length;
        let onTimeCount = 0;
        let delayedCount = 0;
        
        this.trainData.active.forEach(train => {
            // Calculate accurate delay from NextStationETA - ScheduledTime
            const calculatedDelay = this.calculateDelayFromETA(train);
            const delay = calculatedDelay !== null ? calculatedDelay : (train.LateBy || 0);
            if (delay <= 5) {
                onTimeCount++;
            } else {
                delayedCount++;
            }
        });
        
        // Update stat cards
        const activeEl = document.getElementById('activeTrainsCount');
        const onTimeEl = document.getElementById('onTimeTrains');
        const delayedEl = document.getElementById('delayedTrains');
        
        if (activeEl) activeEl.textContent = activeCount;
        if (onTimeEl) onTimeEl.textContent = onTimeCount;
        if (delayedEl) delayedEl.textContent = delayedCount;
    }

    initializeLiveTrackingSearch() {
        const searchInput = document.getElementById('liveTrackingSearchInput');
        const clearButton = document.getElementById('clearLiveTrackingSearch');
        const searchResults = document.getElementById('liveTrackingSearchResults');
        
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.trim();
                if (query.length > 0) {
                    this.isLiveSearchActive = true;
                    this.filterLiveTrainsBySearch(query);
                    if (clearButton) clearButton.style.display = 'block';
                    if (searchResults) searchResults.style.display = 'block';
                } else {
                    this.clearLiveTrackingSearch();
                }
            });
        }
        
        if (clearButton) {
            clearButton.addEventListener('click', () => {
                this.clearLiveTrackingSearch();
            });
        }
    }

    filterLiveTrainsBySearch(query) {
        if (!this.trainData.active) return;
        
        const searchQuery = query.toLowerCase();
        const filteredTrains = this.trainData.active.filter(train => {
            const trainName = train.TrainName ? train.TrainName.toLowerCase() : '';
            const trainNumber = train.TrainNumber ? train.TrainNumber.toString() : '';
            const location = train.Location ? train.Location.toLowerCase() : '';
            
            return String(trainName).includes(searchQuery) || 
                   String(trainNumber).includes(searchQuery) || 
                   location.includes(searchQuery);
        });
        
        this.populateFilteredLiveTrains(filteredTrains, query);
        this.updateLiveSearchResults(filteredTrains.length, query);
    }

    populateFilteredLiveTrains(filteredTrains, query) {
        const container = document.getElementById('liveTrainsListDetail');
        if (!container) return;

        let html = '';
        
        filteredTrains.forEach(train => {
            // Use InnerKey first as it's the unique identifier for each train instance
            const trainId = train.InnerKey || train.TrainID || train.trainId || train.TrainNumber || 'unknown';
            const trainNumber = String(train.TrainNumber);
            const trainName = train.TrainName || 'Unknown Train';
            const speed = train.SpeedKmph || train.Speed || 0;
            const location = train.Location || train.NextStation || 'Unknown Location';

            // Calculate accurate delay from ETA
            const calculatedDelay = this.calculateDelayFromETA(train);
            const delay = calculatedDelay !== null ? calculatedDelay : (train.LateBy || 0);

            // Use NextStationETA from API for accurate ETA
            const eta = this.calculateTrainETA(train);

            // Get scheduled time for next station and format it
            const scheduledTime = this.getScheduledTimeForNextStation(train);
            const formattedScheduledTime = scheduledTime.replace('📅 ', '');
            const scheduledTimeAMPM = formattedScheduledTime !== 'Loading...' && formattedScheduledTime !== 'Schedule N/A'
                ? this.formatTimeAMPM(formattedScheduledTime)
                : formattedScheduledTime;

            // Get last updated time and train date
            const lastUpdated = this.formatLastUpdated(train.LastUpdated || train.__last_updated || train.last_updated);
            const trainDate = this.getTrainDate(train.LastUpdated || train.__last_updated || train.last_updated, train.InnerKey, train.TrainNumber);

            html += `
                <div class="train-card" onclick="mobileApp.openTrainDetails('${trainId}')">
                    <div class="train-card-header ${delay > 0 ? 'header-delayed' : 'header-ontime'}">
                        <div class="train-header-content">
                            <div class="train-name">${trainName}</div>
                        </div>
                        <button class="favorite-btn ${this.favoriteTrains.includes(trainNumber) ? 'favorited' : ''}" onclick="event.stopPropagation(); mobileApp.toggleFavorite('${trainNumber}')" title="${this.favoriteTrains.includes(trainNumber) ? 'Remove from favorites' : 'Add to favorites'}">
                            <span>${this.favoriteTrains.includes(trainNumber) ? '⭐' : '☆'}</span>
                        </button>
                    </div>
                    <div class="train-route">
                        <div class="train-number">#${train.TrainNumber}</div>
                        <div class="train-route-arrow">→</div>
                        <div class="next-station">${location}</div>
                    </div>
                    <div class="train-info-grid">
                        <div class="info-row">
                            <span class="info-icon">📍</span>
                            <span class="info-text">Next Station: ${location}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-icon">📅</span>
                            <span class="info-text">Scheduled: ${scheduledTimeAMPM}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-icon">⏱️</span>
                            <span class="info-text">Delay: ${delay > 0 ? this.formatDelayDisplay(delay) : 'On Time'}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-icon">⏰</span>
                            <span class="info-text">${eta}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-icon">⚡</span>
                            <span class="info-text">Speed: ${speed} km/h</span>
                        </div>
                        <div class="info-row">
                            <span class="info-icon">📅</span>
                            <span class="info-text">Train Date: ${trainDate}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-icon">🔄</span>
                            <span class="info-text">Updated: ${lastUpdated}</span>
                        </div>
                    </div>
                    <div class="train-status-row">
                        <div class="status-badge ${speed > 0 ? 'status-moving' : 'status-stopped'}">
                            ${speed > 0 ? 'Moving' : 'Stopped'}
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

        // Update results count when filtering
        const resultsCountEl = document.getElementById('liveTrackingResultsCount');
        if (resultsCountEl) {
            const liveTrains = filteredTrains.filter(t => t.Speed !== undefined).length;
            resultsCountEl.textContent = `${filteredTrains.length} trains found (${liveTrains} live)`;
        }
    }

    updateLiveSearchResults(count, query) {
        const resultsElement = document.getElementById('liveTrackingSearchResults');
        if (resultsElement) {
            resultsElement.textContent = `Found ${count} train${count !== 1 ? 's' : ''} matching "${query}"`;
        }
    }

    clearLiveTrackingSearch() {
        const searchInput = document.getElementById('liveTrackingSearchInput');
        const clearButton = document.getElementById('clearLiveTrackingSearch');
        const searchResults = document.getElementById('liveTrackingSearchResults');
        
        this.isLiveSearchActive = false;
        if (searchInput) searchInput.value = '';
        if (clearButton) clearButton.style.display = 'none';
        if (searchResults) searchResults.style.display = 'none';
        
        // Repopulate with all trains
        this.populateLiveTrackingScreen();
    }

    openTrainDetails(trainId) {
        console.log('🚂 Opening train details for:', trainId);
        this.navigateToScreen('liveTrainDetail');
        this.loadTrainDetails(trainId);
    }

    async loadTrainDetails(trainId) {
        try {
            console.log('🚂 Loading details for train:', trainId);
            
            // Fetch fresh live train data first to ensure we have the latest info
            console.log('📡 Fetching fresh train data...');
            await this.loadLiveTrains();
            
            console.log('🔍 Searching in filtered train data:', this.trainData.active.length, 'trains');

            // Find train in live data
            const train = this.trainData.active.find(t =>
                String(t.InnerKey) === String(trainId) ||
                String(t.TrainId) === String(trainId) ||
                String(t.TrainNumber) === String(trainId)
            );

            if (!train) {
                console.error('❌ Train not found in filtered data');
                console.log('Available InnerKeys:', this.trainData.active.map(t => t.InnerKey).join(', '));
                throw new Error(`Train ${trainId} not found in current live data. This train may have been filtered out as an old instance.`);
            }

            console.log('✅ Found train:', train.TrainName, 'InnerKey:', train.InnerKey, 'NextStation:', train.NextStation);

            this.currentTrainData = train;
            this.lastUpdatedTime = new Date();
            this.trainDetailLastUpdatedTime = new Date();
            this.populateTrainDetails(train);

            // Try to load schedule data
            if (train.TrainNumber) {
                const schedResponse = await fetch(getAPIPath(`/api/train/${train.TrainNumber}`));
                const schedData = await schedResponse.json();

                if (schedData.success && schedData.data?.schedule) {
                    this.populateRouteStations(schedData.data.schedule, train);
                    
                    // Show notification settings (only if not already exists)
                    const existingNotificationSection = document.querySelector('.notification-settings');
                    if (!existingNotificationSection) {
                        console.log('🔔 Creating notification section (first time)');
                        this.showNotificationSettings(train, schedData.data.schedule, false);
                    } else {
                        console.log('✅ Notification section already exists - preserving it');
                    }
                }
            }

            // Start auto-refresh for real-time updates (every 30 seconds)
            this.startDetailAutoRefresh();

        } catch (error) {
            console.error('❌ Error loading train details:', error);
            this.showTrainDetailsError(error.message);
        }
    }

    startDetailAutoRefresh() {
        console.log(`🔄 [startDetailAutoRefresh] Called - currentTrainData exists: ${!!this.currentTrainData}, currentRouteStations exists: ${!!this.currentRouteStations}`);
        this.stopDetailAutoRefresh();
        this.startTrainDetailClock();

        // Update progress bar and locomotive immediately
        console.log('🚀 [startDetailAutoRefresh] Calling updateProgressBarWithRouteData() for initial position');
        console.log(`   Train: ${this.currentTrainData?.TrainName}, NextStation: ${this.currentTrainData?.NextStation}`);
        console.log(`   Route stations count: ${this.currentRouteStations?.length || 0}`);
        this.updateProgressBarWithRouteData();

        // Refresh everything every 10 seconds (metrics, popover, progress bar, locomotive)
        this.detailRefreshInterval = setInterval(async () => {
            if (this.currentScreen === 'liveTrainDetail' && this.currentTrainData) {
                console.log('⏱️ 10-SECOND UPDATE: Refreshing all train data (metrics, popover, locomotive position)');
                await this.refreshTrainDetails();
            }
        }, 10000);
        
        console.log('✅ Auto-refresh interval started: Everything updates every 10 seconds');
    }

    stopDetailAutoRefresh() {
        if (this.detailRefreshInterval) {
            clearInterval(this.detailRefreshInterval);
            this.detailRefreshInterval = null;
        }
        if (this.progressBarUpdateInterval) {
            clearInterval(this.progressBarUpdateInterval);
            this.progressBarUpdateInterval = null;
        }
        if (this.trainDetailClockInterval) {
            clearInterval(this.trainDetailClockInterval);
            this.trainDetailClockInterval = null;
        }
    }
    
    startTrainDetailClock() {
        // Clear any existing clock interval
        if (this.trainDetailClockInterval) {
            clearInterval(this.trainDetailClockInterval);
        }
        
        // Update clock immediately
        this.updateTrainDetailClock();
        
        // Then update every second
        this.trainDetailClockInterval = setInterval(() => {
            if (this.currentScreen === 'liveTrainDetail') {
                this.updateTrainDetailClock();
            }
        }, 1000);
    }
    
    updateTrainDetailClock() {
        const clockEl = document.getElementById('trainDetailClock');
        if (clockEl) {
            const now = new Date();
            const hours = now.getHours();
            const minutes = now.getMinutes();
            const seconds = now.getSeconds();
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const displayHours = hours % 12 || 12;
            
            clockEl.textContent = `${displayHours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} ${ampm}`;
        }
    }

    getCurrentStationIndex() {
        if (!this.currentTrainData || !this.currentRouteStations) {
            return 0;
        }
        
        const stations = this.currentRouteStations;
        const train = this.currentTrainData;
        const nextLocation = train.NextStation || '';
        
        // Find the next station index
        let nextStationIndex = -1;
        if (nextLocation) {
            nextStationIndex = stations.findIndex(s => {
                const stationName = s.StationName || s.name || '';
                return stationName.toLowerCase().includes(nextLocation.toLowerCase()) ||
                       nextLocation.toLowerCase().includes(stationName.toLowerCase());
            });
        }
        
        // Fallback
        if (nextStationIndex === -1) {
            nextStationIndex = 0;
        }
        
        // Check if train has reached the next station (within 2 minutes of ETA)
        let hasReachedNextStation = false;
        if (train.NextStationETA && train.NextStationETA !== '--:--') {
            const etaMinutes = this.parseTimeToMinutes(train.NextStationETA);
        const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            
            if (etaMinutes !== null) {
                let minutesUntilArrival = etaMinutes - currentMinutes;
                if (minutesUntilArrival < 0) minutesUntilArrival += 1440;
                
                if (minutesUntilArrival <= 2) {
                    hasReachedNextStation = true;
                }
            }
        }
        
        // Return the progress index: last completed station
        return hasReachedNextStation ? nextStationIndex : (nextStationIndex > 0 ? nextStationIndex - 1 : 0);
    }

    updateProgressBarWithRouteData() {
        console.log(`📍 [updateProgressBarWithRouteData] Called`);
        console.log(`   currentTrainData: ${!!this.currentTrainData}, currentRouteStations: ${!!this.currentRouteStations}`);
        
        if (!this.currentTrainData || !this.currentRouteStations) {
            console.warn(`⚠️ [updateProgressBarWithRouteData] Missing data, cannot update progress bar`);
            return;
        }
        
        const stations = this.currentRouteStations;
        const train = this.currentTrainData;
        
        console.log(`   Train: ${train.TrainName}, NextStation: ${train.NextStation}`);
        console.log(`   Stations count: ${stations.length}`);
        console.log(`   Train coordinates: (${train.Latitude}, ${train.Longitude})`);
        
        // Try to find current station first
        const currentLoc = train.CurrentStation || train.LastStation || '';
        let currentStationIndex = -1;
        
        if (currentLoc) {
            currentStationIndex = stations.findIndex(s => {
                const stationName = (s.StationName || s.name || '').toLowerCase();
                const searchLoc = currentLoc.toLowerCase();
                return stationName.includes(searchLoc) || searchLoc.includes(stationName);
            });
        }
        
        // If not found, use next station to calculate (train is one station before next)
        if (currentStationIndex === -1 && train.NextStation) {
            const nextLoc = train.NextStation.toLowerCase();
            const nextIdx = stations.findIndex(s => {
                const stationName = (s.StationName || s.name || '').toLowerCase();
                return stationName.includes(nextLoc) || nextLoc.includes(stationName);
            });
            if (nextIdx > 0) {
                currentStationIndex = nextIdx - 1;
            }
        }
        
        // Fallback to first station
        if (currentStationIndex === -1) {
            currentStationIndex = 0;
        }

        console.log(`📊 Progress Update: CurrentStation="${currentLoc}", NextStation="${train.NextStation}", FoundIndex=${currentStationIndex}, StationName="${stations[currentStationIndex]?.StationName}"`);
        console.log(`   Calling updateProgressBar() with stationIndex=${currentStationIndex}`);
        
        this.updateProgressBar(stations, currentStationIndex, train);
        
        console.log(`✅ [updateProgressBarWithRouteData] Completed - progress bar should now be updated`);
    }

    async refreshTrainDetails() {
        try {
            console.log('🔄 Refreshing train details (10-second cycle)...');
            await this.loadLiveTrains();
            const trainId = this.currentTrainData.InnerKey || this.currentTrainData.TrainId;
            const updatedTrain = this.trainData.active.find(t =>
                String(t.InnerKey) === String(trainId) || String(t.TrainId) === String(trainId)
            );

            if (updatedTrain) {
                console.log('✅ Found updated train data');
                this.currentTrainData = updatedTrain;
                this.lastUpdatedTime = new Date();
                this.trainDetailLastUpdatedTime = new Date();

                // Update metrics (speed, delay, next station)
                this.updateTrainMetrics(updatedTrain);

                if (updatedTrain.TrainNumber) {
                    const schedResponse = await fetch(getAPIPath(`/api/train/${updatedTrain.TrainNumber}`));
                    const schedData = await schedResponse.json();
                    if (schedData.success && schedData.data?.schedule) {
                        this.currentRouteStations = schedData.data.schedule;
                        
                        // Update vertical route stations
                        this.populateVerticalRouteStations(schedData.data.schedule, updatedTrain);
                        
                        // Update progress bar and locomotive position with latest data
                        this.updateProgressBarWithRouteData();
                        
                        console.log('✅ Train details refreshed successfully (metrics, route, progress bar, locomotive)');
                    }
                }
            } else {
                console.warn('⚠️ Updated train not found in active trains');
            }
        } catch (error) {
            console.error('❌ Error refreshing train details:', error);
        }
    }
    

    updateTrainMetrics(train) {
        if (!train) {
            console.warn('⚠️ updateTrainMetrics called with null/undefined train');
            return;
        }
        
        console.log('📊 Updating train metrics:', {
            speed: train.Speed,
            nextStation: train.NextStation,
            delay: train.LateBy
        });
        
        const speedEl = document.getElementById('trainSpeed');
        const delayEl = document.getElementById('trainDelay');
        const nextStationEl = document.getElementById('nextStation');
        
        if (!speedEl || !delayEl || !nextStationEl) {
            console.error('❌ Metric elements not found!', {
                speedEl: !!speedEl,
                delayEl: !!delayEl,
                nextStationEl: !!nextStationEl
            });
            return;
        }
        
        const isOutOfCoverage = this.isTrainOutOfCoverage(train);
        const calculatedDelay = this.calculateDelayFromETA(train);
        const displayDelay = calculatedDelay !== null ? calculatedDelay : (train.LateBy || 0);

        if (isOutOfCoverage) {
            speedEl.textContent = 'N/A';
            delayEl.textContent = 'OUT OF COVERAGE';
            nextStationEl.textContent = 'Location Unknown';
            console.log('🚫 Train out of coverage - metrics set to N/A');
        } else {
            const speedText = `${train.Speed || 0} km/h`;
            const delayText = this.formatDelayDisplay(displayDelay);
            const nextStationText = train.NextStation || 'Unknown';
            
            speedEl.textContent = speedText;
            delayEl.textContent = delayText;
            nextStationEl.textContent = nextStationText;
            
            console.log('✅ Metrics updated:', {
                speed: speedText,
                delay: delayText,
                nextStation: nextStationText
            });
        }
    }

    populateTrainDetails(train) {
        if (!train) {
            console.warn('⚠️ populateTrainDetails called with null/undefined train data');
            return;
        }
        
        // Check if train is out of coverage
        const isOutOfCoverage = this.isTrainOutOfCoverage(train);
        
        // Update basic train info
        document.getElementById('trainDetailName').textContent = train.TrainName || 'Unknown Train';
        document.getElementById('trainDetailNumber').textContent = train.TrainNumber || '000';
        
        // Add out of coverage indicator to header
        const header = document.querySelector('#liveTrainDetail .sticky-header');
        if (header) {
            // Remove existing out of coverage indicator
            const existingIndicator = header.querySelector('.out-of-coverage-indicator');
            if (existingIndicator) {
                existingIndicator.remove();
            }
            
            // Add out of coverage indicator if needed
            if (isOutOfCoverage) {
                const indicator = document.createElement('div');
                indicator.className = 'out-of-coverage-indicator';
                indicator.innerHTML = `
                    <div class="out-of-coverage-badge">
                        <span class="offline-icon">📡</span>
                        OUT OF COVERAGE
                    </div>
                `;
                
                const headerContent = header.querySelector('.header-content-sticky');
                if (headerContent) {
                    headerContent.appendChild(indicator);
                }
            }
        }
        
        // Add favorite button to header if it doesn't exist
        let headerActions = header ? header.querySelector('.header-right-actions') : null;

        if (headerActions) {
            const existingFavoriteBtn = headerActions.querySelector('.favorite-btn');
            if (!existingFavoriteBtn) {
                const favoriteBtn = document.createElement('button');
                favoriteBtn.className = 'header-icon-btn favorite-btn';
                favoriteBtn.onclick = () => this.toggleFavorite(train.TrainNumber);

                // Insert before refresh button
                const refreshBtn = headerActions.querySelector('.refresh-btn');
                if (refreshBtn) {
                    headerActions.insertBefore(favoriteBtn, refreshBtn);
                } else {
                    headerActions.appendChild(favoriteBtn);
                }
            }

            // Update favorite button state
            const favoriteBtn = headerActions.querySelector('.favorite-btn');
            if (favoriteBtn) {
                const isFavorited = this.isFavorite(train.TrainNumber);
                favoriteBtn.innerHTML = isFavorited ?
                    `<svg class="icon-svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>` :
                    `<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>`;
                favoriteBtn.className = `header-icon-btn favorite-btn ${isFavorited ? 'favorited' : ''}`;
                favoriteBtn.onclick = () => this.toggleFavorite(train.TrainNumber);
            }
        }
        
        // Calculate accurate delay from NextStationETA vs scheduled time
        const calculatedDelay = this.calculateDelayFromETA(train);
        const displayDelay = calculatedDelay !== null ? calculatedDelay : (train.LateBy || 0);

        // Update metrics
        if (isOutOfCoverage) {
            document.getElementById('trainSpeed').textContent = 'N/A';
            document.getElementById('trainDelay').textContent = 'OUT OF COVERAGE';
            document.getElementById('nextStation').textContent = 'Location Unknown';
        } else {
        document.getElementById('trainSpeed').textContent = `${train.Speed || 0} km/h`;
        document.getElementById('trainDelay').textContent = this.formatDelayDisplay(displayDelay);
        document.getElementById('nextStation').textContent = train.NextStation || 'Unknown';
        }

        // Update last updated time
        // Update route stations progress bar (with slight delay to allow DOM to settle)
        setTimeout(() => {
            this.updateRouteStationsProgress(train);
        }, 100);

        // Add click interactivity to metric cards
        this.addMetricCardInteractivity(train);
    }


    async updateRouteStationsProgress(train) {
        if (!train) {
            console.warn('⚠️ updateRouteStationsProgress called with null/undefined train data');
            return;
        }
        
        const routeStationsContainer = document.getElementById('routeStations');
        const progressIndicator = document.getElementById('progressIndicator');
        
        console.log(`🔍 Found routeStationsContainer:`, !!routeStationsContainer);
        console.log(`🔍 Found progressIndicator:`, !!progressIndicator);
        
        if (!routeStationsContainer || !progressIndicator) {
            console.warn(`⚠️ Missing elements - routeStationsContainer: ${!!routeStationsContainer}, progressIndicator: ${!!progressIndicator}`);
            return;
        }
        
        let stations = [];
        
        // First try to get data from existing station route list (which is already loaded)
        const stationRouteList = document.getElementById('stationRouteList');
        if (stationRouteList && stationRouteList.children.length > 0) {
            console.log(`🚉 Found ${stationRouteList.children.length} children in stationRouteList`);
            
            // Debug: log the children to see what we have
            Array.from(stationRouteList.children).forEach((child, i) => {
                console.log(`🚉 Child ${i}:`, child.className, child.textContent?.substring(0, 50));
            });
            
            stations = Array.from(stationRouteList.children)
                .filter(item => !item.classList.contains('loading'))
                .map((item, index) => {
                    const nameEl = item.querySelector('.station-name');
                    const timeEl = item.querySelector('.station-time, .departure-time, .arrival-time');
                    const statusEl = item.querySelector('.station-status');
                    
                    console.log(`🚉 Processing item ${index}:`, {
                        nameEl: nameEl?.textContent,
                        timeEl: timeEl?.textContent,
                        statusEl: statusEl?.textContent,
                        fullText: item.textContent
                    });
                    
                    return {
                        StationName: nameEl ? nameEl.textContent.trim() : 'Unknown',
                        ArrivalTime: timeEl ? timeEl.textContent.trim() : '--:--',
                        DepartureTime: timeEl ? timeEl.textContent.trim() : '--:--',
                        Status: statusEl ? statusEl.textContent.trim() : ''
                    };
                });
            console.log(`🚉 Extracted ${stations.length} stations from route list`);
        } else {
            console.log('🚉 No existing stationRouteList found or empty');
        }
        
        // If no stations from route list, try API as fallback
        if (stations.length === 0) {
            console.log('📡 Trying API fallback for stations...');
            try {
                const response = await fetch(getAPIPath(`/api/train/${train.TrainNumber}`));
                const data = await response.json();
                
                if (data.success && data.data && data.data.schedule) {
                    stations = data.data.schedule;
                    console.log(`📡 Got ${stations.length} stations from API`);
                    console.log(`📡 First few stations:`, stations.slice(0, 3));
                } else {
                    console.log('📡 API response did not contain schedule data');
                    console.log('📡 API response structure:', data);
                }
            } catch (error) {
                console.error('❌ Error loading route stations from API:', error);
            }
        }
        
        // If still no stations, create basic route from train data
        if (stations.length === 0) {
            console.log('🏗️ Creating basic route from train data...');
            const currentLocation = train.NextStation || train.Location || 'Unknown';
            stations = [
                {
                    StationName: 'Origin',
                    ArrivalTime: '--:--',
                    DepartureTime: '--:--'
                },
                {
                    StationName: currentLocation,
                    ArrivalTime: '--:--', 
                    DepartureTime: '--:--'
                },
                {
                    StationName: 'Destination',
                    ArrivalTime: '--:--',
                    DepartureTime: '--:--'
                }
            ];
            console.log(`🏗️ Created basic route with ${stations.length} stations`);
        }
        
        console.log(`🔄 About to call populateRouteStations with ${stations.length} stations`);
        
        try {
            this.populateRouteStations(stations, train);
            console.log(`✅ populateRouteStations completed successfully`);
        } catch (error) {
            console.error(`❌ Error in populateRouteStations:`, error);
        }
        
        // Progress bar and scroll updates are now handled inside populateRouteStations
    }

    populateRouteStations(stations, train) {
        console.error(`🚨🚨🚨 NEW VERSION LOADED ${Date.now()}`);
        console.log(`🔥🔥🔥 CACHE BUSTER v3.0 - ${Date.now()}`);
        console.log(`🎯 FUNCTION START - ${new Date().toISOString()}`);
        console.log(`🚀🚀🚀 [${new Date().toLocaleTimeString()}] populateRouteStations called with ${stations.length} stations`);
        console.log(`🚀 First station:`, stations[0]);

        // Calculate distances if not provided in station data
        if (!stations[0]?.DistanceFromOrigin && stations.length > 0 && stations[0]?.Latitude && stations[0]?.Longitude) {
            console.log('📏 Calculating distances from coordinates...');
            let cumulativeDistance = 0;
            stations[0].DistanceFromOrigin = 0;
            
            for (let i = 1; i < stations.length; i++) {
                if (stations[i].Latitude && stations[i].Longitude && 
                    stations[i-1].Latitude && stations[i-1].Longitude) {
                    const segmentDistance = this.calculateDistance(
                        stations[i-1].Latitude, stations[i-1].Longitude,
                        stations[i].Latitude, stations[i].Longitude
                    );
                    cumulativeDistance += segmentDistance;
                    stations[i].DistanceFromOrigin = cumulativeDistance;
                    console.log(`📏 Station ${i} (${stations[i].StationName}): ${cumulativeDistance.toFixed(2)} km from origin`);
                }
            }
        }

        // Store stations for realtime progress updates
        this.currentRouteStations = stations;

        let container = document.getElementById('routeStations');
        console.log(`🚀 Container lookup result:`, container);

        if (!container) {
            console.warn('⚠️ Route stations container not found by ID');
            // Try to find it by class name as fallback
            container = document.querySelector('.route-stations');
            if (container) {
                console.log('🔍 Found container by class name instead');
            } else {
                console.error('❌ Could not find routeStations container by ID or class');
                return;
            }
        }

        console.log(`📍 Populating ${stations.length} route stations`);
        console.log(`📍 Container found:`, container);
        console.log(`📍 Container current content:`, container.innerHTML);

        if (stations.length === 0) {
            container.innerHTML = '<div class="loading">No route stations available</div>';
            return;
        }

        // Calculate total route distance
        const totalDistance = stations[stations.length - 1]?.DistanceFromOrigin || 0;
        console.log(`📏 Total route distance: ${totalDistance} km`);

        // Calculate minimum width needed for proper spacing
        // Use a scale factor to ensure stations have adequate space
        const minWidth = Math.max(stations.length * 150, 1500); // Minimum 150px per station or 1500px

        let html = `<div class="route-stations-inner" style="position: relative; min-width: ${minWidth}px; height: 100%;">`;

        // Add route line and progress indicator with locomotive
        console.log(`🏗️ Creating progress bar HTML with initial width: 0%`);
        html += `
            <div class="route-line">
                <div class="progress-indicator" id="progressIndicator" style="width: 0%"></div>
            </div>
            <div class="train-locomotive-icon" id="trainLocomotiveIcon" style="left: 0%;">
                <img src="/locomotive_1f682.png" alt="Train" />
            </div>
        `;
        console.log(`✅ Progress bar HTML created (will be set to 0% initially, then updated by updateProgressBarWithRouteData)`);

        // Use NextStation to find where the train is heading
        const nextLocation = train.NextStation || '';
        const currentLocation = train.CurrentStation || train.LastStation || '';
        console.log(`🎯 Next station: ${nextLocation}, Current/Last: ${currentLocation}`);
        
        // Find the next station index (where train is heading)
        let nextStationIndex = -1;
        if (nextLocation) {
            nextStationIndex = stations.findIndex(s => {
                const stationName = s.StationName || s.name || '';
                return stationName.toLowerCase().includes(nextLocation.toLowerCase()) ||
                       nextLocation.toLowerCase().includes(stationName.toLowerCase());
            });
        }
        
        // If next station not found, try current/last station
        if (nextStationIndex === -1 && currentLocation) {
            nextStationIndex = stations.findIndex(s => {
                const stationName = s.StationName || s.name || '';
                return stationName.toLowerCase().includes(currentLocation.toLowerCase()) ||
                       currentLocation.toLowerCase().includes(stationName.toLowerCase());
            });
        }
        
        // Fallback: if still not found, assume first station
        if (nextStationIndex === -1) {
            nextStationIndex = 0;
        }
        
        console.log(`🎯 Next station index: ${nextStationIndex}, Station: ${stations[nextStationIndex]?.StationName || 'Unknown'}`);

        // Calculate accurate delay from NextStationETA - ScheduledTime
        const calculatedDelay = this.calculateDelayFromETA(train);
        const trainDelay = calculatedDelay !== null ? calculatedDelay : (train.LateBy || 0);
        
        // Check if train has reached the next station (within 2 minutes of ETA)
        let hasReachedNextStation = false;
        if (train.NextStationETA && train.NextStationETA !== '--:--') {
            const etaMinutes = this.parseTimeToMinutes(train.NextStationETA);
            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            
            if (etaMinutes !== null) {
                let minutesUntilArrival = etaMinutes - currentMinutes;
                if (minutesUntilArrival < 0) minutesUntilArrival += 1440;
                
                if (minutesUntilArrival <= 2) {
                    hasReachedNextStation = true;
                    console.log(`✅ Train has reached next station (${minutesUntilArrival} min until ETA)`);
                }
            }
        }
        
        // Determine the "current" station for progress bar and status
        // If train has reached next station, mark it as completed and move to the one after
        let currentStationIndex = nextStationIndex;
        if (hasReachedNextStation && nextStationIndex < stations.length - 1) {
            currentStationIndex = nextStationIndex + 1;
            console.log(`🎯 Train reached station, moving current to next: index ${currentStationIndex}`);
        }

        stations.forEach((station, index) => {
            console.log(`🚉 Station ${index}:`, station);
            const stationName = station.StationName || station.name || station.StationId || `Station ${index + 1}`;
            const scheduledTime = station.ArrivalTime || station.time || '--:--';
            const distance = station.DistanceFromOrigin || 0;
            console.log(`🚉 Using station name: "${stationName}", scheduled: "${scheduledTime}", distance: ${distance} km`);

            // Calculate position based on distance (as percentage of inner container width)
            const positionPercent = totalDistance > 0 ? (distance / totalDistance) * 100 : (index / (stations.length - 1)) * 100;

            // Determine station status
            let status = 'upcoming';
            let timeClass = '';

            if (index < currentStationIndex) {
                // Stations before current (including reached stations) are completed
                status = 'completed';
                timeClass = 'completed-time';
            } else if (index === currentStationIndex) {
                // Current/next station where train is heading
                status = 'current';
                timeClass = 'current-time';
            } else {
                // Stations after current are upcoming
                status = 'upcoming';
                timeClass = 'upcoming-time';
            }

            // Calculate ETA (scheduled + delay) for current and upcoming stations
            let displayTime = scheduledTime;
            let isAlreadyFormatted = false;

            if (status !== 'completed' && scheduledTime !== '--:--' && trainDelay !== 0) {
                displayTime = this.adjustTimeForDelay(scheduledTime, trainDelay);
                isAlreadyFormatted = true; // adjustTimeForDelay returns formatted time
            }

            // Only format if not already formatted
            const formattedTime = isAlreadyFormatted ? displayTime : this.formatTimeAMPM(displayTime);

            // Get ETA and status info for popover
            const etaTime = status !== 'completed' ? formattedTime : '--:--';
            const statusText = status === 'completed' ? 'Completed' : status === 'current' ? 'Next Station' : 'Upcoming';
            const lastUpdated = train.LastUpdated ? this.formatLastUpdated(new Date(train.LastUpdated)) : '--:--';
            
            // Alternate station names between top and bottom
            const positionClass = index % 2 === 0 ? 'label-bottom' : 'label-top';

            html += `
                <div class="station-point ${status} ${positionClass}" 
                     data-station="${stationName}" 
                     data-distance="${distance}" 
                     data-scheduled="${scheduledTime}"
                     data-eta="${etaTime}"
                     data-status="${statusText}"
                     data-last-updated="${lastUpdated}"
                     style="left: ${positionPercent}%;">
                    <div class="station-dot"></div>
                    <div class="station-info">
                        <div class="station-name">${stationName}</div>
                        <div class="station-time ${timeClass}">${formattedTime}</div>
                    </div>
                </div>
            `;
        });

        html += '</div>';

        console.log(`🔧 REACHED HTML GENERATION with ${stations.length} stations`);

        // Generate dynamic HTML from actual station data
        console.log(`🔧 About to set innerHTML. Current content:`, container.innerHTML.substring(0, 100));
        container.innerHTML = html;
        console.log(`✅ Updated routeStations container with ${stations.length} dynamic stations`);
        console.log(`🔧 Container content after update:`, container.innerHTML.substring(0, 100));
        
        // Verify progress bar was created
        const progressBar = document.getElementById('progressIndicator');
        const locomotive = document.getElementById('trainLocomotiveIcon');
        console.log(`🔍 After HTML insertion - progressBar exists: ${!!progressBar}, locomotive exists: ${!!locomotive}`);
        if (progressBar) {
            console.log(`📊 Progress bar current width: ${progressBar.style.width}`);
        }
        if (locomotive) {
            console.log(`🚂 Locomotive current left: ${locomotive.style.left}`);
        }

        // Also populate vertical route stations
        this.populateVerticalRouteStations(stations, train);
        
        console.log(`📍 populateRouteStations() finished - progress bar at 0%, will be updated by startDetailAutoRefresh() or updateRouteStationsProgress()`);
        
        // Scroll to current station
        setTimeout(() => this.scrollToCurrentStation(), 100);
    }
    
    addStationPopovers() {
        const stationPoints = document.querySelectorAll('.route-stations-inner .station-point');
        const locomotive = document.getElementById('trainLocomotive');
        
        // Remove any existing popover
        const existingPopover = document.querySelector('.station-popover.persistent');
        if (existingPopover) {
            existingPopover.remove();
        }
        
        if (!locomotive) {
            console.warn('⚠️ Locomotive element not found');
            return;
        }
        
        // Find the next/current station for popover data
        let targetPoint = null;
        let hasReachedStation = false;
        
        stationPoints.forEach((point, index) => {
            if (point.classList.contains('current')) {
                targetPoint = point;
                
                // Check if train has actually reached this station
                const eta = point.getAttribute('data-eta') || '--:--';
                
                if (eta && eta !== '--:--' && this.currentTrainData) {
                    const etaMinutes = this.parseTimeToMinutes(eta);
                    const now = new Date();
                    const currentMinutes = now.getHours() * 60 + now.getMinutes();
                    
                    if (etaMinutes !== null) {
                        let minutesUntilArrival = etaMinutes - currentMinutes;
                        if (minutesUntilArrival < 0) minutesUntilArrival += 1440;
                        
                        if (minutesUntilArrival <= 2) {
                            hasReachedStation = true;
                        }
                    }
                }
            }
        });
        
        // If no current station found, use first station
        if (!targetPoint && stationPoints.length > 0) {
            targetPoint = stationPoints[0];
            hasReachedStation = true;
        }
        
        // Create popover on the locomotive (always visible)
        if (targetPoint) {
            const scheduled = targetPoint.getAttribute('data-scheduled') || '--:--';
            const eta = targetPoint.getAttribute('data-eta') || '--:--';
            const status = targetPoint.getAttribute('data-status') || 'Unknown';
            const lastUpdated = targetPoint.getAttribute('data-last-updated') || '--:--';
            const stationName = targetPoint.getAttribute('data-station') || 'Unknown';
            
            // Only show "Current:" label if train has reached the station
            const currentLabelHTML = hasReachedStation ? `
                <div class="popover-row popover-station-name">
                    <span class="popover-label">Current:</span>
                    <span class="popover-value">${stationName}</span>
                </div>
            ` : '';
            
            const popover = document.createElement('div');
            popover.className = 'station-popover persistent locomotive-popover';
            popover.innerHTML = `
                <div class="popover-content">
                    ${currentLabelHTML}
                    <div class="popover-row">
                        <span class="popover-label">Next:</span>
                        <span class="popover-value">${stationName}</span>
                    </div>
                    <div class="popover-row">
                        <span class="popover-label">ETA:</span>
                        <span class="popover-value">${eta}</span>
                    </div>
                    <div class="popover-row">
                        <span class="popover-label">Status:</span>
                        <span class="popover-value">${status}</span>
                    </div>
                    <div class="popover-row">
                        <span class="popover-label">Updated:</span>
                        <span class="popover-value">${lastUpdated}</span>
                    </div>
                </div>
            `;
            
            // Append popover to the locomotive
            locomotive.appendChild(popover);
        }
    }


    scrollToCurrentStation() {
        const routeStations = document.getElementById('routeStations');
        const currentStation = routeStations ? routeStations.querySelector('.station-point.current') : null;
        
        if (currentStation && routeStations) {
            const containerWidth = routeStations.offsetWidth;
            const stationLeft = currentStation.offsetLeft;
            const stationWidth = currentStation.offsetWidth;
            
            // Scroll to center the current station
            const scrollLeft = stationLeft - (containerWidth / 2) + (stationWidth / 2);
            
            routeStations.scrollTo({
                left: scrollLeft,
                behavior: 'smooth'
            });
        }
    }
    
    addMetricCardInteractivity(train) {
        const metricCards = document.querySelectorAll('#liveTrainDetail .metric-card');
        metricCards.forEach((card, index) => {
            card.style.cursor = 'pointer';
            card.onclick = () => {
                // Add haptic feedback and visual response
                card.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    card.style.transform = '';
                }, 150);
                
                // Show detailed info based on metric type
                switch(index) {
                    case 0: // Speed
                        this.showSpeedDetails(train);
                        break;
                    case 1: // Delay
                        this.showDelayDetails(train);
                        break;
                    case 2: // Next Station
                        this.showStationDetails(train);
                        break;
                }
            };
        });
    }
    
    showSpeedDetails(train) {
        if (!train) {
            alert('Speed Details:\n\nTrain data not available');
            return;
        }
        
        const currentSpeed = train.Speed || 0;
        const maxSpeed = currentSpeed > 80 ? currentSpeed : 120;
        const speedPercentage = (currentSpeed / maxSpeed * 100).toFixed(0);
        alert(`Speed Details:\n\nCurrent: ${currentSpeed} km/h\nMax Expected: ${maxSpeed} km/h\nPerformance: ${speedPercentage}%`);
    }
    
    showDelayDetails(train) {
        if (!train) {
            alert('Delay Information:\n\nTrain data not available');
            return;
        }
        
        const delay = train.LateBy || 0;
        const delayStatus = delay === 0 ? 'On Time' : delay > 0 ? 'Delayed' : 'Early';
        const delayText = this.formatDelayDisplay(delay);
        const lastUpdated = train.LastUpdated ? new Date(train.LastUpdated).toLocaleString() : 'Unknown';
        alert(`Delay Information:\n\nStatus: ${delayStatus}\nDelay: ${delayText}\nLast Updated: ${lastUpdated}`);
    }
    
    showStationDetails(train) {
        if (!train) {
            alert('Station Information:\n\nTrain data not available');
            return;
        }
        
        const eta = train.NextStationETA || 'Unknown';
        const status = train.Status === 'A' ? 'Active' : train.Status === 'D' ? 'Departed' : 'En Route';
        alert(`Station Information:\n\nNext Station: ${train.NextStation || 'Unknown'}\nETA: ${eta}\nTrain Status: ${status}`);
    }
    
    refreshTrainDetails() {
        if (this.currentTrainData) {
            console.log('🔄 Refreshing train details...');
            this.loadTrainDetails(this.currentTrainData.InnerKey || this.currentTrainData.TrainId);
        }
    }

    populateVerticalRouteStations(stations, train) {
        // This function populates the vertical route stations list below
        const container = document.getElementById('stationRouteList');
        if (!container || stations.length === 0) return;

        let html = '';
        const currentStationName = train.NextStation || train.Location || '';
        let currentStationIndex = stations.findIndex(s =>
            s.StationName && currentStationName &&
            (s.StationName.toLowerCase().includes(currentStationName.toLowerCase()) ||
             currentStationName.toLowerCase().includes(s.StationName.toLowerCase()))
        );

        if (currentStationIndex === -1) currentStationIndex = Math.floor(stations.length * 0.6);

        // Get train delay in minutes - use calculated delay from ETA if available
        const calculatedDelay = this.calculateDelayFromETA(train);
        const trainDelay = calculatedDelay !== null ? calculatedDelay : (train.LateBy || 0);

        stations.forEach((station, index) => {
            const stationName = station.StationName || `Station ${index + 1}`;
            const isFirst = index === 0;

            // Get scheduled times
            const scheduledArr = station.ArrivalTime || '--:--';
            const scheduledDep = station.DepartureTime || '--:--';
            const actualArr = station.ActualArrivalTime;
            const actualDep = station.ActualDepartureTime;

            let status = 'upcoming';
            let statusIcon = '⭕';
            let scheduledArrival = '--:--';
            let expectedArrival = '--:--';
            let stationDelay = 'N/A';
            let delayClass = 'on-time';

            // Determine station status
            if (index < currentStationIndex) {
                status = 'passed';
                statusIcon = '✔️';
            } else if (index === currentStationIndex) {
                status = 'current';
                statusIcon = '🚂';
            }

            // Calculate arrival/departure times and delays
            if (isFirst) {
                // First station - use departure time
                scheduledArrival = scheduledDep || '--:--';

                if (actualDep) {
                    expectedArrival = actualDep;
                    stationDelay = 'Departed';
                    delayClass = 'passed';
                } else if (index <= currentStationIndex) {
                    expectedArrival = scheduledDep || '--:--';
                    stationDelay = 'Departed';
                    delayClass = 'passed';
                } else {
                    if (scheduledDep) {
                        if (trainDelay !== 0) {
                            expectedArrival = this.adjustTimeForDelay(scheduledDep, trainDelay);
                            stationDelay = this.formatDelayDisplay(trainDelay);
                            delayClass = trainDelay > 0 ? 'late' : 'early';
                        } else {
                            expectedArrival = scheduledDep;
                            stationDelay = 'On Time';
                            delayClass = 'on-time';
                        }
                    }
                }
            } else {
                // All other stations - use arrival times
                scheduledArrival = scheduledArr || '--:--';

                if (index < currentStationIndex) {
                    // Passed stations
                    if (actualArr && scheduledArr) {
                        expectedArrival = actualArr;
                        stationDelay = 'Passed';
                        delayClass = 'passed';
                    } else {
                        expectedArrival = scheduledArr || '--:--';
                        stationDelay = 'Passed';
                        delayClass = 'passed';
                    }
                } else if (index === currentStationIndex) {
                    // Current station
                    const stationTime = scheduledArr || scheduledDep;
                    if (stationTime) {
                        if (trainDelay !== 0) {
                            expectedArrival = this.adjustTimeForDelay(stationTime, trainDelay);
                            stationDelay = this.formatDelayDisplay(trainDelay);
                            delayClass = trainDelay > 0 ? 'late' : 'early';
                        } else {
                            expectedArrival = stationTime;
                            stationDelay = 'On Time';
                            delayClass = 'current';
                        }
                    } else if (train.NextStationETA && train.NextStationETA !== '--:--') {
                        expectedArrival = train.NextStationETA;
                        stationDelay = trainDelay !== 0 ? this.formatDelayDisplay(trainDelay) : 'Arriving';
                        delayClass = trainDelay > 0 ? 'late' : trainDelay < 0 ? 'early' : 'current';
                    } else {
                        expectedArrival = 'Arriving';
                        stationDelay = 'Current';
                        delayClass = 'current';
                    }
                } else {
                    // Future stations
                    if (scheduledArr) {
                        if (trainDelay !== 0) {
                            expectedArrival = this.adjustTimeForDelay(scheduledArr, trainDelay);
                            stationDelay = this.formatDelayDisplay(trainDelay);
                            delayClass = trainDelay > 0 ? 'late' : 'early';
                        } else {
                            expectedArrival = scheduledArr;
                            stationDelay = 'On Time';
                            delayClass = 'on-time';
                        }
                    }
                }
            }

            // Format times to AM/PM format
            const formattedScheduledArrival = scheduledArrival !== '--:--' && scheduledArrival !== 'N/A'
                ? this.formatTimeAMPM(scheduledArrival) : scheduledArrival;

            // Don't format expectedArrival if it's already formatted (contains AM/PM) from adjustTimeForDelay
            const formattedExpectedArrival = (expectedArrival !== '--:--' && expectedArrival !== 'N/A' && expectedArrival !== 'Arriving' && !expectedArrival.includes('AM') && !expectedArrival.includes('PM'))
                ? this.formatTimeAMPM(expectedArrival) : expectedArrival;

            // Build timing info HTML based on status
            let timingInfoHTML = '';

            if (status === 'passed') {
                // For passed stations, don't show any timing info
                timingInfoHTML = '';
            } else if (status === 'current') {
                // For current station, show scheduled time and ETA prominently
                const lastUpdated = train.LastUpdated ? this.formatLastUpdated(train.LastUpdated) : 'Unknown';
                timingInfoHTML = `
                    <div class="station-timing-info">
                        <div class="timing-row">
                            <span class="timing-group">
                                <span class="timing-label">Scheduled:</span>
                                <span class="timing-value">${formattedScheduledArrival}</span>
                            </span>
                        </div>
                        <div class="timing-row eta-row-highlight">
                            <span class="timing-group">
                                <span class="timing-label">ETA:</span>
                                <span class="eta-value-large">${formattedExpectedArrival}</span>
                            </span>
                        </div>
                        <div class="timing-row">
                            <span class="timing-group">
                                <span class="timing-label">Status:</span>
                                <span class="delay-value ${delayClass}">${stationDelay}</span>
                            </span>
                        </div>
                        <div class="timing-row">
                            <span class="timing-group">
                                <span class="timing-label">Last Updated:</span>
                                <span class="timing-value">${lastUpdated}</span>
                            </span>
                        </div>
                    </div>
                `;
            } else {
                // For upcoming stations, show all details
                timingInfoHTML = `
                    <div class="station-timing-info">
                        <div class="timing-row">
                            <span class="timing-group">
                                <span class="timing-label">Scheduled:</span>
                                <span class="timing-value">${formattedScheduledArrival}</span>
                            </span>
                        </div>
                        <div class="timing-row">
                            <span class="timing-group">
                                <span class="timing-label">Expected:</span>
                                <span class="eta-value">${formattedExpectedArrival}</span>
                            </span>
                        </div>
                        <div class="timing-row">
                            <span class="timing-group">
                                <span class="timing-label">Status:</span>
                                <span class="delay-value ${delayClass}">${stationDelay}</span>
                            </span>
                        </div>
                    </div>
                `;
            }

            // Build additional info if available
            const additionalInfoParts = [];
            if (station.Platform) {
                additionalInfoParts.push(`<span class="platform-info">🚉 Platform ${station.Platform}</span>`);
            }
            if (station.DistanceFromOrigin) {
                const distance = parseFloat(station.DistanceFromOrigin).toFixed(2);
                additionalInfoParts.push(`<span class="distance-info">📍 ${distance} km</span>`);
            }
            const additionalInfoHTML = additionalInfoParts.length > 0
                ? `<div class="additional-info">${additionalInfoParts.join('')}</div>`
                : '';

            html += `
                <div class="station-route-item ${status}" data-station-index="${index}">
                    <div class="station-row">
                        <div class="station-icon-wrapper">
                            <div class="station-status-icon ${status}">${statusIcon}</div>
                        </div>
                        <div class="station-name-wrapper">
                            <span class="station-name">${stationName}</span>
                        </div>
                    </div>
                    ${timingInfoHTML ? `<div class="station-timing-wrapper">${timingInfoHTML}</div>` : ''}
                    ${additionalInfoHTML ? `<div class="station-additional-wrapper">${additionalInfoHTML}</div>` : ''}
                    ${index < stations.length - 1 ? '<div class="timeline-connector"></div>' : ''}
                </div>
            `;
        });

        container.innerHTML = html;
    }

    updateJourneyMap(stations, currentStationIndex, train) {
        if (!stations || stations.length === 0) return;

        // Update source station (only if element exists - for backward compatibility)
        const sourceStation = stations[0];
        const sourceStationEl = document.getElementById('sourceStation');
        if (sourceStation && sourceStationEl) {
            sourceStationEl.textContent = sourceStation.StationName || 'Origin';
        }

        // Update destination station (only if element exists - for backward compatibility)
        const destinationStation = stations[stations.length - 1];
        const destinationStationEl = document.getElementById('destinationStation');
        if (destinationStation && destinationStationEl) {
            destinationStationEl.textContent = destinationStation.StationName || 'Destination';
        }
    }

    calculateTimeDelay(scheduledTime, actualTime) {
        if (!scheduledTime || !actualTime) return 0;
        
        const scheduled = this.parseTime(scheduledTime);
        const actual = this.parseTime(actualTime);
        
        return actual - scheduled; // Return delay in minutes
    }

    addMinutesToTime(timeString, minutes) {
        if (!timeString || timeString === '--:--') return timeString;
        
        const [hours, minutesPart] = timeString.split(':');
        let totalMinutes = parseInt(hours) * 60 + parseInt(minutesPart) + minutes;
        
        // Handle day overflow
        if (totalMinutes >= 1440) totalMinutes -= 1440;
        if (totalMinutes < 0) totalMinutes += 1440;
        
        const newHours = Math.floor(totalMinutes / 60);
        const newMinutes = totalMinutes % 60;
        
        return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
    }

    updateProgressBar(stations, currentStationIndex, train) {
        if (!stations || stations.length === 0 || !train) return;

        // Get total route distance
        const totalDistance = stations[stations.length - 1]?.DistanceFromOrigin || 0;

        // Calculate progress percentage
        let progressPercentage = 0;

        if (currentStationIndex >= 0 && stations.length > 1 && totalDistance > 0) {
            const currentStation = stations[currentStationIndex];
            const currentDistance = currentStation?.DistanceFromOrigin || 0;

            // Base progress at current station (based on distance, not index)
            const baseProgress = (currentDistance / totalDistance) * 100;

            // Try to use train's actual coordinates for precise positioning (like map)
            let useCoordinatePosition = false;
            console.log(`🔍 Checking coordinate-based positioning: TrainLat=${train.Latitude}, TrainLng=${train.Longitude}, CurrentIdx=${currentStationIndex}, NextIdx=${currentStationIndex + 1}`);
            
            if (train.Latitude && train.Longitude && currentStationIndex < stations.length - 1) {
                const nextStation = stations[currentStationIndex + 1];
                console.log(`📊 Current: ${currentStation.StationName} (${currentStation.Latitude}, ${currentStation.Longitude}), Next: ${nextStation.StationName} (${nextStation.Latitude}, ${nextStation.Longitude})`);
                
                if (currentStation.Latitude && currentStation.Longitude && 
                    nextStation.Latitude && nextStation.Longitude) {
                    
                    // Calculate distance from train to current and next stations
                    const distToCurrent = this.calculateDistance(
                        train.Latitude, train.Longitude,
                        currentStation.Latitude, currentStation.Longitude
                    );
                    const distToNext = this.calculateDistance(
                        train.Latitude, train.Longitude,
                        nextStation.Latitude, nextStation.Longitude
                    );
                    const segmentLength = this.calculateDistance(
                        currentStation.Latitude, currentStation.Longitude,
                        nextStation.Latitude, nextStation.Longitude
                    );
                    
                    if (segmentLength > 0) {
                        // Calculate how far along the segment the train is
                        // The train has moved distToCurrent away from current station
                        // So progress = distance from current / total segment length
                        const progressAlongSegment = Math.min(distToCurrent / segmentLength, 1.0);
                        
                        // Get distance segment from station data
                        const nextDistance = nextStation?.DistanceFromOrigin || 0;
                const segmentDistance = nextDistance - currentDistance;

                        // Calculate actual distance covered in this segment
                        const distanceCovered = segmentDistance * progressAlongSegment;
                        
                        // Add the partial distance to current distance and convert to percentage
                        progressPercentage = ((currentDistance + distanceCovered) / totalDistance) * 100;
                        
                        useCoordinatePosition = true;
                        console.log(`🌍 Coordinate-based Progress: TrainPos=(${train.Latitude.toFixed(4)},${train.Longitude.toFixed(4)}), DistToCurrent=${distToCurrent.toFixed(2)}km, DistToNext=${distToNext.toFixed(2)}km, SegmentLen=${segmentLength.toFixed(2)}km, Progress=${(progressAlongSegment*100).toFixed(1)}% => Bar:${progressPercentage.toFixed(1)}%`);
                    } else {
                        console.log(`⚠️ Segment length is 0, cannot use coordinate-based positioning`);
                    }
                } else {
                    console.log(`⚠️ Station coordinates missing - Current: ${currentStation.Latitude},${currentStation.Longitude}, Next: ${nextStation.Latitude},${nextStation.Longitude}`);
                }
            } else {
                console.log(`⚠️ Cannot use coordinates - TrainHasCoords: ${!!(train.Latitude && train.Longitude)}, HasNextStation: ${currentStationIndex < stations.length - 1}`);
            }
            
            // Fallback to time-based calculation if coordinates not available
            if (!useCoordinatePosition && currentStationIndex < stations.length - 1 && 
                train.NextStationETA && train.NextStationETA !== '--:--') {
                const nextStation = stations[currentStationIndex + 1];
                const nextDistance = nextStation?.DistanceFromOrigin || 0;
                
                // Distance segment between current and next station
                const segmentDistance = nextDistance - currentDistance;
                
                // Get scheduled time for next station
                const scheduledTime = nextStation?.ArrivalTime || nextStation?.DepartureTime;
                
                if (scheduledTime && scheduledTime !== '--:--' && segmentDistance > 0) {
                    try {
                        // Get current time
                        const now = new Date();
                        const currentMinutes = now.getHours() * 60 + now.getMinutes();

                        // Parse ETA
                        const etaMinutes = this.parseTimeToMinutes(train.NextStationETA);

                        // Get departure time from current station
                        const departureTime = currentStation?.DepartureTime || currentStation?.ArrivalTime;
                        const departureMinutes = departureTime ? this.parseTimeToMinutes(departureTime) : null;
                        
                        if (etaMinutes !== null && departureMinutes !== null) {
                            // Calculate total segment time and elapsed time
                            let totalSegmentTime = etaMinutes - departureMinutes;
                            if (totalSegmentTime < 0) totalSegmentTime += 1440; // Handle day boundary
                            
                            let elapsedTime = currentMinutes - departureMinutes;
                            if (elapsedTime < 0) elapsedTime += 1440; // Handle day boundary
                            
                            // Calculate partial progress (0 to 1)
                            let partialProgress = 0;
                            if (totalSegmentTime > 0 && elapsedTime >= 0) {
                                partialProgress = Math.min(elapsedTime / totalSegmentTime, 0.99); // Cap at 99% until arrival
                            }
                            
                            // Calculate how much distance the train has covered in this segment
                            const distanceCovered = segmentDistance * partialProgress;
                            
                            // Add the partial distance to current distance and convert to percentage
                            progressPercentage = ((currentDistance + distanceCovered) / totalDistance) * 100;
                            
                            console.log(`⏱️ Time-based Progress: CurrentDist=${currentDistance}km, SegmentDist=${segmentDistance}km, Covered=${distanceCovered.toFixed(1)}km, Total=${totalDistance}km => ${progressPercentage.toFixed(1)}%`);
                        } else {
                            progressPercentage = baseProgress;
                        }
                    } catch (error) {
                        console.error('Error calculating partial progress:', error);
                        progressPercentage = baseProgress;
                    }
                } else {
                    progressPercentage = baseProgress;
                }
            } else if (!useCoordinatePosition) {
                // No next station or no ETA, just show at current station
                progressPercentage = baseProgress;
            }
        } else if (totalDistance === 0) {
            // Fallback to index-based calculation if no distance data
            const baseProgress = stations.length > 1 ? (currentStationIndex / (stations.length - 1)) * 100 : 0;
            progressPercentage = baseProgress;
            console.log(`⚠️ No distance data available, using index-based progress: ${progressPercentage.toFixed(1)}%`);
        }

        // Ensure progress is within bounds
        progressPercentage = Math.max(0, Math.min(100, progressPercentage));

        // Update the progress bar and locomotive position
        const progressIndicator = document.querySelector('.progress-indicator');
        const locomotiveIcon = document.getElementById('trainLocomotiveIcon');
        
        if (progressIndicator) {
            progressIndicator.style.width = `${progressPercentage}%`;
            console.log(`📊 Progress bar width updated: ${progressPercentage.toFixed(1)}%`);
        } else {
            console.warn('⚠️ Progress indicator element not found');
        }
        
        if (locomotiveIcon) {
            locomotiveIcon.style.left = `${progressPercentage}%`;
            console.log(`🚂 Locomotive position updated: ${progressPercentage.toFixed(1)}%`);
            
            // Create or update locomotive popover
            this.updateLocomotivePopover(locomotiveIcon, train, stations, currentStationIndex);
            
            // Keep locomotive in viewport
            this.scrollLocomotiveIntoView(locomotiveIcon);
        } else {
            console.warn('⚠️ Locomotive icon element not found');
        }

        // Update journey map stations
        this.updateJourneyMap(stations, currentStationIndex, train);

        const trainSpeed = train && train.Speed ? train.Speed : 0;
        const trainStatus = train && train.Status ? train.Status : 'Unknown';
        const currentDistance = stations[currentStationIndex]?.DistanceFromOrigin || 0;
        console.log(`🗺️ Progress: ${progressPercentage.toFixed(1)}% (Station ${currentStationIndex + 1}/${stations.length}, Status: ${trainStatus}, Speed: ${trainSpeed} km/h, Distance: ${currentDistance}/${totalDistance} km)`);
    }

    getCurrentTime() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    scrollLocomotiveIntoView(locomotiveIcon) {
        if (!locomotiveIcon) return;
        const routeStations = document.querySelector('.route-stations');
        if (!routeStations) return;
        
        // Wait for popover to render
        setTimeout(() => {
            const popover = locomotiveIcon.querySelector('.locomotive-popover');
            
            // Get actual popover width
            let popoverWidth = 180;
            if (popover && popover.offsetWidth > 0) {
                popoverWidth = popover.offsetWidth;
            }
            
            // Position locomotive at: popover width + 60px from left edge of SCREEN (not container)
            // This ensures the popover is fully visible on the left side
            const offset = popoverWidth-100;
            const locomotiveLeft = locomotiveIcon.offsetLeft;
            
            // Target scroll position to keep locomotive + popover visible
            const targetScrollLeft = locomotiveLeft - offset;
            
            // Only scroll if locomotive is not already visible in the correct position
            const currentScroll = routeStations.scrollLeft;
            const viewportWidth = routeStations.clientWidth;
            const locomotiveViewportPos = locomotiveLeft - currentScroll;
            
            // If locomotive is outside the safe zone (offset to viewportWidth - offset), scroll
            if (locomotiveViewportPos < offset || locomotiveViewportPos > viewportWidth - offset) {
                routeStations.scrollTo({
                    left: Math.max(0, targetScrollLeft),
                    behavior: 'smooth'
                });
                console.log(`🚂 Scrolling: PopoverWidth=${popoverWidth}px, Offset=${offset}px, LocomotiveLeft=${locomotiveLeft}px, CurrentScroll=${currentScroll}px, TargetScroll=${Math.max(0, targetScrollLeft)}px`);
            } else {
                console.log(`🚂 No scroll needed: Locomotive already visible at position ${locomotiveViewportPos}px`);
            }
        }, 150);
    }

    updateLocomotivePopover(locomotiveIcon, train, stations, currentStationIndex) {
        if (!locomotiveIcon || !train || !stations || stations.length === 0) return;
        
        // Check if popover already exists as child of locomotive
        let popover = locomotiveIcon.querySelector('.locomotive-popover');
        
        if (!popover) {
            // Create popover element and append to locomotive icon itself
            popover = document.createElement('div');
            popover.className = 'locomotive-popover';
            locomotiveIcon.appendChild(popover);
        }
        
        // Get next station from train API data
        const nextStationName = train.NextStation || 'Unknown';
        
        // Get train info
        const speed = train.Speed || 0;
        const status = speed > 0 ? 'Moving' : 'Stopped';
        const eta = train.NextStationETA || '--:--';
        
        // Calculate delay
        const delay = this.calculateDelayFromETA(train);
        const delayText = this.formatDelayDisplay(delay);
        
        // Get last updated
        const lastUpdated = train.LastUpdated ? this.formatLastUpdated(train.LastUpdated) : 'Unknown';
        
        // Clear and rebuild popover content
        popover.innerHTML = '';
        
        // Build rows
        const rows = [
            { label: 'Next', value: nextStationName },
            { label: 'ETA', value: eta },
            { label: 'Speed', value: `${speed} km/h` },
            { label: 'Status', value: status },
            { label: 'Delay', value: delayText },
            { label: 'Last Updated', value: lastUpdated }
        ];
        
        rows.forEach(row => {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'popover-row';
            rowDiv.innerHTML = `<strong>${row.label}:</strong> <span>${row.value}</span>`;
            popover.appendChild(rowDiv);
        });
    }

    updateJourneyMap(stations, currentStationIndex, train) {
        if (!stations || stations.length === 0) return;

        // Update source station (only if element exists - for backward compatibility)
        const sourceStation = stations[0];
        const sourceStationEl = document.getElementById('sourceStation');
        if (sourceStation && sourceStationEl) {
            sourceStationEl.textContent = sourceStation.StationName || 'Origin';
        }

        // Update destination station (only if element exists - for backward compatibility)
        const destinationStation = stations[stations.length - 1];
        const destinationStationEl = document.getElementById('destinationStation');
        if (destinationStation && destinationStationEl) {
            destinationStationEl.textContent = destinationStation.StationName || 'Destination';
        }

        // Update current station in journey map
        const currentStation = stations[currentStationIndex];
        if (currentStation) {
            const currentStationNameEl = document.querySelector('.route-stations .station-point.active .station-name');
            const currentTimeEl = document.querySelector('.route-stations .station-point.active .station-time');
            
            if (currentStationNameEl) {
                currentStationNameEl.textContent = currentStation.StationName || train.NextStation || 'Current';
            }
            if (currentTimeEl) {
                // Use NextStationETA from API for most accurate real-time data
                let etaTime;
                if (train.NextStationETA && train.NextStationETA !== '--:--') {
                    // Prioritize API ETA as it's real-time
                    etaTime = this.formatTimeAMPM(train.NextStationETA);
                } else {
                    // Fallback: Calculate from scheduled time + delay
                    const delay = train.LateBy || 0;
                    const scheduledArr = currentStation.ArrivalTime;
                    const scheduledDep = currentStation.DepartureTime;
                    const stationTime = scheduledArr || scheduledDep;

                    if (stationTime && stationTime !== '--:--') {
                        etaTime = this.adjustTimeForDelay(stationTime, delay);
                    } else {
                        // Last resort: current time
                        etaTime = new Date().toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                        });
                    }
                }
                currentTimeEl.textContent = `ETA ${etaTime}`;
            }
        }

        // Update station point classes in journey map
        const stationPoints = document.querySelectorAll('.route-stations .station-point');
        stationPoints.forEach((point, index) => {
            point.classList.remove('completed', 'active', 'upcoming');
            
            if (index === 0 && currentStationIndex > 0) {
                point.classList.add('completed');
            } else if (index < currentStationIndex) {
                point.classList.add('completed');
            } else if (index === currentStationIndex) {
                point.classList.add('active');
            } else {
                point.classList.add(currentStationIndex >= stations.length - 1 ? 'active' : 'upcoming');
            }
        });
    }

    calculateTimeDelay(scheduledTime, actualTime) {
        try {
            const scheduled = new Date(`2000-01-01 ${scheduledTime}`);
            const actual = new Date(`2000-01-01 ${actualTime}`);
            
            // Handle next day scenarios
            if (actual < scheduled && (scheduled.getHours() > 20 && actual.getHours() < 4)) {
                actual.setDate(actual.getDate() + 1);
            }
            
            const diffMs = actual - scheduled;
            const diffMinutes = Math.round(diffMs / (1000 * 60));
            return diffMinutes;
        } catch (error) {
            return 0;
        }
    }

    addMinutesToTime(timeString, minutes) {
        try {
            if (!timeString || timeString === '--:--' || !minutes) {
                return timeString || '--:--';
            }
            
            const [hours, mins] = timeString.split(':').map(Number);
            const date = new Date(2000, 0, 1, hours, mins);
            date.setMinutes(date.getMinutes() + minutes);
            
            const newHours = String(date.getHours()).padStart(2, '0');
            const newMins = String(date.getMinutes()).padStart(2, '0');
            
            return `${newHours}:${newMins}`;
        } catch (error) {
            return timeString || '--:--';
        }
    }

    calculateTrainETA(train) {
        // Prioritize NextStationETA from API as it's the most accurate real-time data
        if (train.NextStationETA && train.NextStationETA !== '--:--') {
            return `ETA ${this.formatTimeAMPM(train.NextStationETA)}`;
        }

        // Fallback: Calculate from scheduled time + delay if API ETA not available
        let nextStationArrivalTime = null;
        const delay = train.LateBy || 0;

        if (this.scheduleData && this.scheduleData.length > 0 && train.NextStation) {
            // Find the train in schedule data
            const trainNumber = train.TrainNumber || train.trainNumber;
            const scheduledTrain = this.scheduleData.find(schedTrain =>
                String(schedTrain.trainNumber) === String(trainNumber) ||
                String(schedTrain.TrainNumber) === String(trainNumber)
            );

            if (scheduledTrain && scheduledTrain.stations) {
                // Find the next station in the schedule
                const nextStationData = scheduledTrain.stations.find(station =>
                    station.StationName === train.NextStation ||
                    station.StationName.includes(train.NextStation) ||
                    train.NextStation.includes(station.StationName)
                );

                if (nextStationData) {
                    // Use arrival time with departure fallback
                    nextStationArrivalTime = nextStationData.ArrivalTime || nextStationData.DepartureTime;
                }
            }
        }

        // If we have scheduled time, adjust it for delay
        if (nextStationArrivalTime && nextStationArrivalTime !== '--:--') {
            const adjustedTime = this.adjustTimeForDelay(nextStationArrivalTime, delay);
            return `ETA ${adjustedTime}`;
        }

        // Last resort: show delay status if no ETA available
        if (delay > 0) {
            return this.formatDelayDisplay(delay);
        } else if (delay < 0) {
            return this.formatDelayDisplay(delay);
        } else {
            return 'On time';
        }
    }
    
    // Calculate delay by comparing NextStationETA with scheduled time
    calculateDelayFromETA(train) {
        try {
            // Calculate delay from NextStationETA - Scheduled Time (Original formula)
            // This is more accurate than API's LateBy field
            if (!train.NextStationETA || train.NextStationETA === '--:--' || !train.NextStation) {
                return null;
            }

            // Get scheduled station info including day indicator
            const stationInfo = this.getScheduledStationInfo(train);
            if (!stationInfo || !stationInfo.arrivalTime) {
                return null;
            }

            // Parse both times to minutes
            const etaMinutes = this.parseTimeToMinutes(train.NextStationETA);
            const scheduledMinutes = this.parseTimeToMinutes(stationInfo.arrivalTime);

            if (etaMinutes === null || scheduledMinutes === null) {
                return null;
            }

            // Calculate raw delay in minutes (ETA - Scheduled)
            let delayMinutes = etaMinutes - scheduledMinutes;

            // Smart day boundary handling using schedule's day indicator
            // If the scheduled station is on Day 2 (+1) or Day 3 (+2), etc.
            // we need to check if the current time has crossed into the next day
            
            const dayCount = stationInfo.dayCount || 1;
            
            if (dayCount > 1) {
                // Station is scheduled for Day 2, 3, etc.
                // If delayMinutes is highly negative (e.g., -1000), it means ETA hasn't crossed into that day yet
                // Example: Scheduled at Day 2, 02:00 (1440 + 120 = 1560 minutes from start)
                //          Current ETA: 23:00 Day 1 (1380 minutes)
                //          Raw delay: 1380 - 120 = 1260 (looks very ahead)
                // We need to add (dayCount - 1) * 1440 to scheduled time conceptually
                
                // Adjust for multi-day journeys
                // If delayMinutes > 720 (12 hours ahead), the ETA is likely on previous day
                if (delayMinutes > 720) {
                    // ETA is still on previous day, subtract days difference
                    delayMinutes -= 1440;
                } else if (delayMinutes < -720) {
                    // ETA has moved ahead into next day
                    delayMinutes += 1440;
                }
            } else {
                // Day 1 stations: Use smarter logic with early morning detection
                // If scheduled time is NOT Day +1 but ETA is after midnight (00:00-05:59),
                // we need to check if we should compare with previous day's schedule
                
                const etaHours = Math.floor(etaMinutes / 60);
                const scheduledHours = Math.floor(scheduledMinutes / 60);
                
                // Detect if ETA crossed into next day (early morning hours after midnight)
                const etaIsEarlyMorning = etaHours >= 0 && etaHours < 6;
                const scheduledIsLateEvening = scheduledHours >= 18; // After 6 PM
                
                if (etaIsEarlyMorning && scheduledIsLateEvening) {
                    // Case: Scheduled at 23:00, ETA at 01:00 (next day)
                    // Raw delay: 60 - 1380 = -1320 (looks very behind)
                    // Correct delay: ETA crossed to next day, so add 24 hours
                    delayMinutes += 1440;
                    console.log(`🌙 Detected ETA crossed midnight: Scheduled ${stationInfo.arrivalTime} (evening), ETA ${train.NextStationETA} (early morning)`);
                } else if (!etaIsEarlyMorning && delayMinutes > 720) {
                    // Case: Scheduled at 02:00, ETA at 23:00 (previous day still)
                    // Raw delay: 1380 - 120 = 1260 (looks very ahead)
                    // Correct delay: Scheduled time crossed to next day, so subtract 24 hours
                    delayMinutes -= 1440;
                    console.log(`🌅 Detected scheduled time is next day: Scheduled ${stationInfo.arrivalTime} (early morning), ETA ${train.NextStationETA} (evening)`);
                } else if (delayMinutes > 720) {
                    // General case: More than 12 hours ahead
                delayMinutes -= 1440; // Subtract 24 hours
                } else if (delayMinutes < -720) {
                    // General case: More than 12 hours behind
                delayMinutes += 1440; // Add 24 hours
                }
            }

            console.log(`📊 Delay calculation: Station: ${stationInfo.stationName}, Day: ${dayCount}, Scheduled: ${stationInfo.arrivalTime}, ETA: ${train.NextStationETA}, Delay: ${delayMinutes}m`);
            return Math.round(delayMinutes);

        } catch (error) {
            console.error('Error calculating delay from ETA:', error);
            return null;
        }
    }

    // Parse time string to total minutes
    parseTimeToMinutes(timeStr) {
        try {
            if (!timeStr || timeStr === '--:--') return null;

            // Handle 12-hour format (e.g., "6:30 PM")
            let hours, minutes;
            const time12Match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
            if (time12Match) {
                hours = parseInt(time12Match[1]);
                minutes = parseInt(time12Match[2]);
                const isPM = time12Match[3].toUpperCase() === 'PM';

                if (isPM && hours !== 12) hours += 12;
                else if (!isPM && hours === 12) hours = 0;
            } else {
                // Handle 24-hour format (e.g., "18:30")
                const time24Match = timeStr.match(/(\d{1,2}):(\d{2})/);
                if (!time24Match) return null;

                hours = parseInt(time24Match[1]);
                minutes = parseInt(time24Match[2]);
            }

            return hours * 60 + minutes;
        } catch (error) {
            console.error('Error parsing time:', error);
            return null;
        }
    }

    // Helper function to adjust scheduled time for delays (same logic as webapp)
    adjustTimeForDelay(timeStr, delayMinutes) {
        if (!timeStr || timeStr === '--:--') return '--:--';

        try {
            console.log(`⏰ adjustTimeForDelay called with time: "${timeStr}", delay: ${delayMinutes} minutes`);

            // Handle both 12-hour and 24-hour formats
            let hours, minutes;

            // Check if time contains AM/PM (12-hour format)
            if (timeStr.includes('AM') || timeStr.includes('PM') || timeStr.includes('am') || timeStr.includes('pm')) {
                // Convert 12-hour to 24-hour first
                const time12 = timeStr.trim();
                const isPM = time12.toLowerCase().includes('pm');
                const isAM = time12.toLowerCase().includes('am');

                const timeParts = time12.replace(/am|pm|AM|PM/gi, '').trim().split(':').map(Number);
                hours = timeParts[0] || 0;
                minutes = timeParts[1] || 0;

                // Convert to 24-hour format
                if (isPM && hours !== 12) {
                    hours += 12;
                } else if (isAM && hours === 12) {
                    hours = 0;
                }
                console.log(`⏰ Converted 12-hour "${timeStr}" to 24-hour: ${hours}:${minutes}`);
            } else {
                // Already in 24-hour format
                const timeParts = timeStr.split(':').map(Number);
                hours = timeParts[0] || 0;
                minutes = timeParts[1] || 0;
            }

            console.log(`⏰ Parsed: ${hours}h ${minutes}m, adding ${delayMinutes} minutes`);

            const totalMinutes = hours * 60 + minutes + (delayMinutes || 0);
            console.log(`⏰ Total minutes: ${totalMinutes}`);

            // Handle day rollover
            let finalHours = Math.floor(totalMinutes / 60) % 24;
            let finalMinutes = totalMinutes % 60;

            if (totalMinutes < 0) {
                finalHours = 24 + finalHours;
            }

            const result24 = `${String(finalHours).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}`;
            const result12 = this.formatTimeAMPM(result24);
            console.log(`⏰ Result: ${result24} (24h) = ${result12} (12h)`);
            return result12;
        } catch (error) {
            console.error('Error adjusting time for delay:', error);
            return timeStr;
        }
    }

    formatDelay(minutes) {
        if (!minutes || minutes === 0) return 'On Time';
        if (minutes > 0) return `${minutes}m Late`;
        return `${Math.abs(minutes)}m Early`;
    }

    // Helper function to format delay in hours and minutes for display only
    formatDelayDisplay(minutes) {
        if (!minutes || minutes === 0) return 'On Time';
        
        const absMinutes = Math.abs(minutes);
        const hours = Math.floor(absMinutes / 60);
        const mins = absMinutes % 60;
        
        let timeStr = '';
        if (hours > 0) {
            timeStr += `${hours}h`;
            if (mins > 0) {
                timeStr += ` ${mins}m`;
            }
        } else {
            timeStr = `${mins}m`;
        }
        
        if (minutes > 0) return `${timeStr} Late`;
        return `${timeStr} Early`;
    }

    // Helper function to format time to 12-hour AM/PM format
    formatTimeAMPM(timeStr) {
        if (!timeStr || timeStr === '--:--' || timeStr === 'N/A') return timeStr;
        
        try {
            const timeParts = timeStr.split(':').map(Number);
            const hours = timeParts[0] || 0;
            const minutes = timeParts[1] || 0;
            
            const date = new Date();
            date.setHours(hours, minutes, 0, 0);
            
            return date.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        } catch (error) {
            return timeStr;
        }
    }

    // Helper function to format last updated timestamp with seconds
    formatLastUpdated(timestamp) {
        if (!timestamp) return 'N/A';
        
        try {
            let date;
            if (typeof timestamp === 'string') {
                date = new Date(timestamp);
            } else if (typeof timestamp === 'number') {
                // Handle Unix timestamp (seconds or milliseconds)
                date = new Date(timestamp < 1000000000000 ? timestamp * 1000 : timestamp);
            } else {
                date = new Date(timestamp);
            }
            
            if (isNaN(date.getTime())) {
                return 'N/A';
            }
            
            return date.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
        } catch (error) {
            return 'N/A';
        }
    }

    // Extract train date from InnerKey using train number to locate date position
    // Format: InnerKey like "125109900" = Train#1 + Date(25/10) + TrainId suffix(9900)
    // TrainId = Train# + 9900 (e.g., 1 + 9900 = 19900)
    // Returns: { day: 25, month: 10, year: 2025, dateString: "25/10/2025" }
    extractDateFromInnerKey(innerKey, trainNumber) {
        try {
            if (!innerKey) return null;
            
            const innerKeyStr = String(innerKey);
            const trainNumStr = String(trainNumber);
            
            // InnerKey format: [TrainNumber][DDMM][9900]
            // Example: 125109900 = Train 1 + Date 25/10 + 9900 (TrainId: 19900)
            // Example: 226109900 = Train 2 + Date 26/10 + 9900 (TrainId: 29900)
            // Example: 10527109900 = Train 105 + Date 27/10 + 9900 (TrainId: 1059900)
            
            // Verify InnerKey starts with the train number
            if (!innerKeyStr.startsWith(trainNumStr)) {
                console.warn(`⚠️ InnerKey ${innerKey} doesn't start with train number ${trainNumber}`);
                return null;
            }
            
            // The last 4 digits are always "9900" (TrainId suffix)
            // After train number, next 4 digits are DDMM
            const trainNumLength = trainNumStr.length;
            
            // Check if we have enough characters for date
            if (innerKeyStr.length < trainNumLength + 8) { // Train# + DDMM(4) + 9900(4)
                console.warn(`⚠️ InnerKey ${innerKey} too short for train ${trainNumber}`);
                return null;
            }
            
            // Extract DDMM: 4 characters starting after train number
            const ddmm = innerKeyStr.substr(trainNumLength, 4);
            const day = parseInt(ddmm.slice(0, 2));
            const month = parseInt(ddmm.slice(2, 4));
            
            console.log(`📅 InnerKey ${innerKey}: Train#${trainNumber} + DDMM="${ddmm}" → ${day}/${month}`);
            
            // Validate day and month
            if (day < 1 || day > 31 || month < 1 || month > 12) {
                console.warn(`⚠️ Invalid date extracted: day=${day}, month=${month}`);
                return null;
            }
            
            // Verify the remaining part is "9900"
            const suffix = innerKeyStr.substr(trainNumLength + 4, 4);
            if (suffix !== '9900') {
                console.warn(`⚠️ Expected suffix "9900" but got "${suffix}" in InnerKey ${innerKey}`);
                return null;
            }
            
            // Use current year as base (trains don't run for more than a year with same number)
            const currentYear = new Date().getFullYear();
            const dateString = `${day}/${month}/${currentYear}`;
            
            return {
                day,
                month,
                year: currentYear,
                dateString,
                sortKey: `${currentYear}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`
            };
        } catch (e) {
            console.error('Error extracting date from InnerKey:', innerKey, e);
            return null;
        }
    }

    getTrainDate(lastUpdated, innerKey = null, trainNumber = null) {
        // Try to extract from InnerKey first
        if (innerKey && trainNumber) {
            const extractedDate = this.extractDateFromInnerKey(innerKey, trainNumber);
            if (extractedDate) {
                return extractedDate.dateString;
            }
        }
        
        // Fallback to LastUpdated
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
    }

    showTrainDetailsError(message) {
        document.getElementById('trainDetailName').textContent = 'Error Loading Train';
        document.getElementById('stationRouteList').innerHTML = `<div class="loading">Error: ${message}</div>`;
    }


    updateActiveTrainsCount() {
        if (!this.trainData || !this.trainData.active) {
            console.log('⚠️ No train data available for stats update');
            // Set to dashes if no data
            const countEl = document.getElementById('activeTrainsCount');
            const onTimeEl = document.getElementById('onTimeTrains'); 
            const delayedEl = document.getElementById('delayedTrains');
            
            if (countEl) countEl.textContent = '--';
            if (onTimeEl) onTimeEl.textContent = '--';
            if (delayedEl) delayedEl.textContent = '--';
            return;
        }
        
        const totalTrains = this.trainData.active.length;
        
        // Calculate on-time and delayed using accurate delay calculation
        let onTimeTrains = 0;
        let delayedTrains = 0;
        
        this.trainData.active.forEach(train => {
            // Use calculated delay from ETA if available
            const calculatedDelay = this.calculateDelayFromETA(train);
            const delay = calculatedDelay !== null ? calculatedDelay : (train.LateBy || 0);
            
            if (delay <= 5) {
                onTimeTrains++;
            } else {
                delayedTrains++;
            }
        });
        
        console.log('📊 Updating home screen stats:', { totalTrains, onTimeTrains, delayedTrains });
        
        const countEl = document.getElementById('activeTrainsCount');
        const onTimeEl = document.getElementById('onTimeTrains'); 
        const delayedEl = document.getElementById('delayedTrains');
        
        if (countEl) countEl.textContent = totalTrains;
        if (onTimeEl) onTimeEl.textContent = onTimeTrains;
        if (delayedEl) delayedEl.textContent = delayedTrains;
        
        // Also update live tracking screen
        this.populateLiveTrackingScreen();
    }

    populateLiveTrackingScreen() {
        const container = document.getElementById('liveTrainsListDetail');
        if (!container || !this.trainData.active) return;

        // Don't repopulate if search is active (search results are already showing)
        if (this.isLiveSearchActive) return;

        let html = '';
        
        this.trainData.active.forEach(train => {
            const trainId = train.InnerKey || train.TrainId || train.TrainNumber;
            const trainName = train.TrainName || `Train ${train.TrainNumber}`;
            const speed = train.Speed || 0;

            // Check if train is out of coverage
            const isOutOfCoverage = this.isTrainOutOfCoverage(train);

            // Calculate accurate delay from ETA
            const calculatedDelay = this.calculateDelayFromETA(train);
            const delay = calculatedDelay !== null ? calculatedDelay : (train.LateBy || 0);

            const location = train.NextStation || 'Location updating...';

            let statusBadge = 'LIVE';
            let badgeColor = '#10B981';

            if (isOutOfCoverage) {
                statusBadge = 'OUT OF COVERAGE';
                badgeColor = '#6B7280';
            } else if (delay > 15) {
                statusBadge = this.formatDelayDisplay(delay).replace(' Late', '');
                badgeColor = '#EF4444';
            } else if (delay > 5) {
                statusBadge = this.formatDelayDisplay(delay).replace(' Late', '');
                badgeColor = '#F59E0B';
            }

            // Calculate ETA for next station
            const eta = this.calculateTrainETA(train);

            // Get scheduled time for next station and format it
            const scheduledTime = this.getScheduledTimeForNextStation(train);
            const formattedScheduledTime = scheduledTime.replace('📅 ', '');
            const scheduledTimeAMPM = formattedScheduledTime !== 'Loading...' && formattedScheduledTime !== 'Schedule N/A' 
                ? this.formatTimeAMPM(formattedScheduledTime) 
                : formattedScheduledTime;
            
            // Get last updated time and train date
            const lastUpdated = this.formatLastUpdated(train.LastUpdated || train.__last_updated || train.last_updated);
            const trainDate = this.getTrainDate(train.LastUpdated || train.__last_updated || train.last_updated, train.InnerKey, train.TrainNumber);

            html += `
                <div class="train-card ${isOutOfCoverage ? 'out-of-coverage' : ''}" onclick="mobileApp.openTrainDetails('${trainId}')">
                    <div class="train-card-header ${isOutOfCoverage ? 'header-out-of-coverage' : (delay > 0 ? 'header-delayed' : 'header-ontime')}">
                        <div class="train-header-content">
                            <div class="train-name">${trainName}</div>
                            ${isOutOfCoverage ? '<div class="out-of-coverage-badge">OUT OF COVERAGE</div>' : ''}
                        </div>
                        <div class="header-actions">
                            <button class="favorite-btn ${this.favoriteTrains.includes(train.TrainNumber) ? 'favorited' : ''}" onclick="event.stopPropagation(); mobileApp.toggleFavorite('${train.TrainNumber}')" title="${this.favoriteTrains.includes(train.TrainNumber) ? 'Remove from favorites' : 'Add to favorites'}">
                                <span>${this.favoriteTrains.includes(train.TrainNumber) ? '⭐' : '☆'}</span>
                            </button>
                            <div class="live-indicator ${isOutOfCoverage ? 'out-of-coverage' : ''}">
                                <span class="live-dot ${isOutOfCoverage ? 'out-of-coverage' : ''}"></span>
                                ${isOutOfCoverage ? 'OFFLINE' : 'LIVE'}
                            </div>
                        </div>
                    </div>
                    <div class="train-route">
                        <div class="train-number">#${train.TrainNumber}</div>
                        <div class="train-route-arrow">→</div>
                        <div class="next-station">${location}</div>
                    </div>
                    <div class="train-info-grid">
                        <div class="info-row">
                            <span class="info-icon">📍</span>
                            <span class="info-text">Next Station: ${location}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-icon">📅</span>
                            <span class="info-text">Scheduled: ${scheduledTimeAMPM}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-icon">⏱️</span>
                            <span class="info-text">Delay: ${delay > 0 ? this.formatDelayDisplay(delay) : 'On Time'}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-icon">⏰</span>
                            <span class="info-text">${eta}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-icon">⚡</span>
                            <span class="info-text">Speed: ${speed} km/h</span>
                        </div>
                        <div class="info-row">
                            <span class="info-icon">📅</span>
                            <span class="info-text">Train Date: ${trainDate}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-icon">🔄</span>
                            <span class="info-text">Updated: ${lastUpdated}</span>
                        </div>
                    </div>
                    <div class="train-status-row">
                        <div class="status-badge ${speed > 0 ? 'status-moving' : 'status-stopped'}">
                            ${speed > 0 ? 'Moving' : 'Stopped'}
                        </div>
                        <div class="delay-badge ${delay > 15 ? 'delay-high' : delay > 5 ? 'delay-medium' : 'delay-none'}">
                            ${delay > 0 ? this.formatDelayDisplay(delay) : 'On Time'}
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
        this.updateFavoriteButtons();
        this.liveTrackingLastUpdatedTime = new Date();

        // Update results count
        const resultsCountEl = document.getElementById('liveTrackingResultsCount');
        if (resultsCountEl) {
            const totalTrains = this.trainData.active.length;
            const liveTrains = this.trainData.active.filter(t => t.Speed !== undefined).length;
            resultsCountEl.textContent = `${totalTrains} trains found (${liveTrains} live)`;
        }
    }

    async loadScheduledTrainsForHome() {
        try {
            console.log('📅 Loading scheduled trains for home...');
            
            // Use hybrid approach: local files first, remote fallback
            const schedulesData = await API_CONFIG.fetchStaticData('schedules');
            const trainsData = await API_CONFIG.fetchStaticData('trains');
            const stationsData = await API_CONFIG.fetchStaticData('stations');
            
            // Extract the actual data (handle Response wrapper if present)
            const schedules = schedulesData.Response || schedulesData;
            const trains = trainsData.Response || trainsData;
            const stations = stationsData.Response || stationsData;
            
            // Build schedule data in the format expected by the app
            this.scheduleData = schedules.map(schedule => {
                const trainInfo = trains.find(t => t.TrainId === schedule.TrainId);
                
                return {
                    trainId: schedule.TrainId,
                    trainNumber: trainInfo ? trainInfo.TrainNumber : 'N/A',
                    trainName: trainInfo ? trainInfo.TrainName : 'Unknown',
                    trainNameUrdu: trainInfo ? trainInfo.TrainNameUrdu : '',
                    stations: schedule.stations || schedule.Stations || []
                };
            });
            
            // Store metadata for other uses
            this.trainsMetadata = trains;
            this.stationsMetadata = stations;
            
            console.log(`✅ Loaded ${this.scheduleData.length} train schedules from hybrid source`);
            
            // Populate UI
            this.populateScheduledTrains(this.scheduleData);
            
            // If live trains are already loaded, refresh them with schedule data
            if (this.trainData && this.trainData.active) {
                this.populateLiveTrains();
            }
            
            // Check for updates in background (non-blocking)
            this.checkForScheduleUpdates();
            
        } catch (error) {
            console.error('❌ Error loading scheduled trains for home:', error);
            this.showError('Unable to load train schedules');
        }
    }
    
    async checkForScheduleUpdates() {
        try {
            console.log('🔍 Checking for schedule updates...');
            const updateInfo = await API_CONFIG.checkForUpdates();
            
            if (updateInfo.hasUpdate) {
                console.log(`📦 New schedule data available! Local: ${updateInfo.localVersion}, Remote: ${updateInfo.remoteVersion}`);
                
                // Optionally show a toast notification to user
                // this.showToast('New train schedules available! Refresh to update.');
                
                // Or auto-update in background
                // await this.updateScheduleData();
            } else {
                console.log('✅ Schedule data is up to date');
            }
        } catch (error) {
            console.warn('⚠️ Could not check for updates:', error.message);
        }
    }
    
    async updateScheduleData() {
        try {
            console.log('📥 Downloading latest schedule data...');
            
            // Force fetch from remote
            const schedulesData = await API_CONFIG.fetchStaticData('schedules', true);
            const trainsData = await API_CONFIG.fetchStaticData('trains', true);
            const stationsData = await API_CONFIG.fetchStaticData('stations', true);
            
            // Cache in localStorage for next launch
            localStorage.setItem('cachedSchedules', JSON.stringify(schedulesData));
            localStorage.setItem('cachedTrains', JSON.stringify(trainsData));
            localStorage.setItem('cachedStations', JSON.stringify(stationsData));
            localStorage.setItem('cacheTimestamp', Date.now().toString());
            
            console.log('✅ Schedule data updated and cached');
            
            // Reload the schedule data
            await this.loadScheduledTrainsForHome();
            
            this.showToast('Train schedules updated!');
        } catch (error) {
            console.error('❌ Error updating schedule data:', error);
        }
    }

    populateScheduledTrains(schedule) {
        const container = document.getElementById('scheduledTrainsList');
        if (!container || !schedule) return;

        let html = '';
        
        // Show first 10 scheduled trains
        schedule.slice(0, 10).forEach(train => {
            const trainId = train.trainId || train.trainNumber;
            const trainName = train.trainName || `Train ${train.trainNumber}`;
            
            // Get first and last station for route info
            const firstStation = train.stations && train.stations.length > 0 ? train.stations[0] : null;
            const lastStation = train.stations && train.stations.length > 0 ? train.stations[train.stations.length - 1] : null;
            
            const departureTime = firstStation && firstStation.DepartureTime ? this.formatTimeAMPM(firstStation.DepartureTime) : '--:--';
            const arrivalTime = lastStation && lastStation.ArrivalTime ? this.formatTimeAMPM(lastStation.ArrivalTime) : '--:--';
            const route = firstStation && lastStation ? `${firstStation.StationName} → ${lastStation.StationName}` : 'Route not available';
            
            // Check if this train has live data matching direction
            const liveTrainData = this.findLiveTrainDataForSchedule(train.trainNumber, train.trainName, firstStation?.StationName, lastStation?.StationName);
            const isLive = !!liveTrainData;

            html += `
                <div class="scheduled-train-card ${isLive ? 'has-live' : ''}" onclick="mobileApp.openTrainScheduleDetails('${trainId}')">
                    <div class="route-header">
                        <div class="route-badge">${train.trainNumber}</div>
                        <div class="route-actions">
                            <button class="favorite-btn" data-train-number="${train.trainNumber}" onclick="event.stopPropagation(); mobileApp.toggleFavorite('${train.trainNumber}')">☆</button>
                            <div class="schedule-status-badge ${isLive ? 'live' : 'scheduled'}">${isLive ? 'LIVE' : 'SCHEDULED'}</div>
                        </div>
                    </div>
                    <h4>${trainName}</h4>
                    <div class="live-train-route">
                        <div class="location-speed">${route}</div>
                        <div class="eta-info-inline">${departureTime} - ${arrivalTime}</div>
                    </div>
                    <div class="route-info">
                        <div class="next-departure">
                            <div>🚉 ${firstStation ? firstStation.StationName : 'Origin'}</div>
                            <div>🕒 ${departureTime}</div>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
        this.updateFavoriteButtons();
    }

    startAutoRefresh() {
        // Refresh every 10 seconds
        setInterval(async () => {
            if (this.currentScreen === 'home' || this.currentScreen === 'liveTracking') {
                // Load schedule data first, then live trains (to ensure schedule data is available)
                await this.loadScheduledTrainsForHome();
                this.loadLiveTrains();

                // Also refresh live updates
                this.loadLiveUpdates();

                // If on liveTracking screen and search is active, reapply the current search
                if (this.currentScreen === 'liveTracking' && this.isLiveSearchActive) {
                    const searchInput = document.getElementById('liveTrackingSearchInput');
                    if (searchInput && searchInput.value) {
                        this.filterLiveTrainsBySearch(searchInput.value);
                    }
                }
            }
        }, 10000); // 10 seconds
    }

    startLastUpdatedCountdown() {
        // Update immediately
        this.updateLastUpdatedTimestamps();
        
        // Then update every second
        setInterval(() => {
            this.updateLastUpdatedTimestamps();
        }, 1000);
    }

    updateLastUpdatedTimestamps() {
        const now = new Date();

        // Update home last updated
        const homeEl = document.getElementById('homeLastUpdated');
        if (homeEl) {
            if (this.homeLastUpdatedTime) {
                const elapsed = this.getTimeElapsed(now, this.homeLastUpdatedTime);
                homeEl.textContent = `Last updated: ${elapsed}`;
            } else {
                homeEl.textContent = 'Last updated: Loading...';
            }
        }

        // Update live tracking last updated
        const liveTrackingEl = document.getElementById('liveTrackingLastUpdated');
        if (liveTrackingEl) {
            if (this.liveTrackingLastUpdatedTime) {
                const elapsed = this.getTimeElapsed(now, this.liveTrackingLastUpdatedTime);
                liveTrackingEl.textContent = `Last updated: ${elapsed}`;
            } else {
                liveTrackingEl.textContent = 'Last updated: Loading...';
            }
        }

        // Update schedule last updated
        const scheduleEl = document.getElementById('scheduleLastUpdated');
        if (scheduleEl) {
            if (this.scheduleLastUpdatedTime) {
                const elapsed = this.getTimeElapsed(now, this.scheduleLastUpdatedTime);
                scheduleEl.textContent = `Last updated: ${elapsed}`;
            } else {
                scheduleEl.textContent = 'Last updated: Loading...';
            }
        }

        // Update train detail last updated
        const trainDetailEl = document.getElementById('trainDetailLastUpdated');
        if (trainDetailEl) {
            if (this.trainDetailLastUpdatedTime) {
                const elapsed = this.getTimeElapsed(now, this.trainDetailLastUpdatedTime);
                trainDetailEl.textContent = `Last updated: ${elapsed}`;
            } else {
                trainDetailEl.textContent = 'Last updated: Loading...';
            }
        }
    }

    getTimeElapsed(now, lastUpdated) {
        const diffSeconds = Math.floor((now - lastUpdated) / 1000);

        if (diffSeconds < 5) {
            return 'Just now';
        } else if (diffSeconds < 60) {
            return `${diffSeconds} seconds ago`;
        } else if (diffSeconds < 3600) {
            const minutes = Math.floor(diffSeconds / 60);
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        } else {
            const hours = Math.floor(diffSeconds / 3600);
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        }
    }

    // Search functionality
    async searchTrains() {
        const query = document.getElementById('trainSearchInput')?.value?.trim();
        if (!query) return;

        try {
            console.log('🔍 Searching trains for:', query);
            const response = await fetch(getAPIUrl('search') + `?q=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            if (data.success && data.data) {
                this.populateSearchResults(data.data);
            } else {
                this.showSearchError('No trains found');
            }
        } catch (error) {
            console.error('❌ Search error:', error);
            this.showSearchError('Search failed');
        }
    }

    populateSearchResults(trains) {
        const container = document.getElementById('trainSearchResults');
        if (!container) return;

        if (trains.length === 0) {
            container.innerHTML = '<div class="empty-state">No trains found</div>';
            return;
        }

        let html = '';
        trains.forEach(train => {
            const trainId = train.TrainNumber || train.train_number;
            const trainName = train.TrainName || train.train_name;
            
            html += `
                <div class="search-result-item" onclick="mobileApp.openTrainDetails('${trainId}')">
                    <div class="train-info">
                        <div class="train-number">${trainId}</div>
                        <div class="train-name">${trainName}</div>
                    </div>
                    <div class="train-route">${train.source || '--'} → ${train.destination || '--'}</div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    showSearchError(message) {
        const container = document.getElementById('trainSearchResults');
        if (container) {
            container.innerHTML = `<div class="empty-state">${message}</div>`;
        }
    }

    // Station search
    async searchStations() {
        const query = document.getElementById('stationSearchInput')?.value?.trim();
        if (!query) return;

        try {
            console.log('🔍 Searching stations for:', query);
            // This would connect to a stations API endpoint
            const container = document.getElementById('stationResults');
            if (container) {
                container.innerHTML = `<div class="loading">Searching stations for "${query}"...</div>`;
            }
        } catch (error) {
            console.error('❌ Station search error:', error);
        }
    }

    // Favorites functionality
    loadFavorites() {
        console.log('========================================');
        console.log('⭐⭐⭐ LOADFAVORITES FUNCTION CALLED ⭐⭐⭐');
        console.log('========================================');
        console.log('⭐ Loading favorites screen');
        console.log('⭐ Favorite train numbers:', this.favoriteTrains);
        console.log('⭐ Favorite trains type:', typeof this.favoriteTrains);
        console.log('⭐ Is array?:', Array.isArray(this.favoriteTrains));
        console.log('⭐ Length:', this.favoriteTrains?.length);
        console.log('⭐ Total active trains available:', this.trainData.active?.length || 0);

        const container = document.getElementById('favoritesList');
        if (!container) {
            console.log('❌ Favorites container not found');
            return;
        }

        // Ensure we have train data loaded
        if (!this.trainData.active || this.trainData.active.length === 0) {
            console.log('⚠️ No train data loaded yet, loading now...');
            container.innerHTML = `
                <div class="empty-state">
                    <p>Loading train data...</p>
                </div>
            `;
            // Load train data and schedule data, then reload favorites
            Promise.all([
                this.loadLiveTrains(),
                this.loadScheduledTrainsForHome()
            ]).then(() => {
                this.loadFavorites();
            });
            return;
        }

        if (this.favoriteTrains.length === 0) {
            console.log('📭 No favorite trains marked');
            container.innerHTML = `
                <div class="empty-state">
                    <p>⭐ No favorite trains yet</p>
                    <p>Tap the star on any train to add it to favorites</p>
                    <p>Available trains: ${this.trainData.active?.length || 0}</p>
                </div>
            `;
            return;
        }

        let html = '';

        // Get all available live trains
        const allAvailableTrains = this.trainData.active || [];
        console.log('🔍 Available trains for favorites:', allAvailableTrains.length);

        // Get live train data to show current info for favorite trains
        this.favoriteTrains.forEach(trainNumber => {
            console.log(`🔍 Looking for favorite train number: "${trainNumber}" (type: ${typeof trainNumber})`);

            // Find all matching trains for this train number
            const matchingTrains = allAvailableTrains.filter(train => {
                const trainNum = String(train.TrainNumber || train.trainNumber);
                const favoriteNum = String(trainNumber);
                return trainNum === favoriteNum;
            });

            console.log(`  Found ${matchingTrains.length} matching train instances`);

            // Sort all matching trains by date (most recent first)
            matchingTrains.sort((a, b) => {
                const dateA = this.extractDateFromInnerKey(a.InnerKey, a.TrainNumber);
                const dateB = this.extractDateFromInnerKey(b.InnerKey, b.TrainNumber);
                
                if (dateA && dateB) {
                    return dateB.sortKey.localeCompare(dateA.sortKey); // Most recent first
                }
                return 0;
            });

            // Show ALL instances of this favorite train (not just the most recent)
            if (matchingTrains.length === 0) {
                console.log(`  No live data found for train #${trainNumber}`);
                return; // Skip if no live data
            }
            
            console.log(`  Showing ${matchingTrains.length} instances of favorite train ${trainNumber}`);
            
            // Loop through all matching train instances
            matchingTrains.forEach(liveTrainData => {

            if (!liveTrainData) {
                console.log(`  No live data found for train #${trainNumber}`);
                // Try to show schedule data if no live train
                const scheduleTrainData = this.scheduleData?.find(train =>
                    String(train.trainNumber || train.TrainNumber) === String(trainNumber)
                );
                
                if (scheduleTrainData) {
                    console.log(`  Showing schedule data for train #${trainNumber}`);
                    // Show schedule data card (existing logic handles this below)
                } else {
                    return; // Skip if no data at all
                }
            }

            console.log(`  Showing most recent train: ${liveTrainData?.TrainName} (${liveTrainData?.InnerKey})`);
            
            // Try to find schedule data for this train
            const scheduleTrainData = this.scheduleData?.find(train =>
                String(train.trainNumber || train.TrainNumber) === String(trainNumber)
            );
            
            // Show favorite trains with their best available data (live or schedule)
            if (!liveTrainData && !scheduleTrainData) {
                console.log(`⚪ Skipping - no data available`);
                return; // Skip only if we have no data at all
            }
            
            const trainName = liveTrainData?.TrainName || 
                             liveTrainData?.trainName || 
                             scheduleTrainData?.trainName ||
                             scheduleTrainData?.TrainName ||
                             `Train ${trainNumber}`;
            
            const isLive = !!liveTrainData;
            const currentStation = liveTrainData?.CurrentStation || 
                                  liveTrainData?.NextStation || 
                                  (isLive ? 'En route' : 'Schedule only');
            
            // Get train date from InnerKey
            const trainDate = liveTrainData ? this.getTrainDate(liveTrainData.LastUpdated, liveTrainData.InnerKey, liveTrainData.TrainNumber) : '';
            
            // Calculate accurate delay from ETA if live data exists
            let delay = 0;
            if (liveTrainData) {
                const calculatedDelay = this.calculateDelayFromETA(liveTrainData);
                delay = calculatedDelay !== null ? calculatedDelay : (liveTrainData.LateBy || 0);
            }

            let statusClass = 'on-time';
            let statusText = isLive ? 'Live & On Time' : 'Scheduled';

            if (isLive && delay > 0) {
                statusClass = delay > 15 ? 'delayed' : 'slightly-delayed';
                statusText = `${delay} min late`;
            }
            
            console.log(`⭐ Showing favorite: ${trainName} (${isLive ? 'LIVE' : 'SCHEDULED'}) - Date: ${trainDate}`);
            
            html += `
                <div class="favorite-train-card ${isLive ? 'has-live' : ''}" onclick="mobileApp.${isLive ? 'openTrainDetails' : 'openTrainScheduleDetails'}('${liveTrainData?.InnerKey || scheduleTrainData?.trainId || trainNumber}')">
                    <div class="favorite-header">
                        <div class="favorite-train-info">
                            <div class="train-number">${trainNumber}</div>
                            <div class="train-name">${trainName}</div>
                        </div>
                        <div class="favorite-actions">
                            <div class="status-badge ${statusClass}">${isLive ? 'LIVE' : 'SCHEDULED'}</div>
                            <button class="favorite-btn favorited" onclick="event.stopPropagation(); mobileApp.toggleFavorite('${trainNumber}')">⭐</button>
                        </div>
                    </div>
                    <div class="favorite-details">
                        ${isLive ? `<div class="current-location">📍 ${currentStation}</div>` : ''}
                        ${isLive && trainDate ? `<div class="train-date">📅 ${trainDate}</div>` : ''}
                        <div class="status-info">${statusText}</div>
                    </div>
                </div>
            `;
            }); // End of matchingTrains.forEach
        }); // End of favoriteTrains.forEach

        if (html === '') {
            console.log('⚠️ No HTML generated for favorite trains');
            html = `
                <div class="empty-state">
                    <p>💤 No favorite trains are live today</p>
                    <p>Your favorite trains will appear here when they're running</p>
                    <p>Favorites: ${this.favoriteTrains.join(', ')}</p>
                </div>
            `;
        }

        console.log('⭐ Setting favorites HTML, length:', html.length);
        container.innerHTML = html;
        console.log('⭐ Favorites container updated successfully');
    }


    // Profile functionality
    loadProfile() {
        const lastUpdateEl = document.getElementById('appLastUpdate');
        if (lastUpdateEl) {
            lastUpdateEl.textContent = new Date().toLocaleString();
        }

        // Load settings
        const autoRefreshToggle = document.getElementById('autoRefreshToggle');
        const notificationsToggle = document.getElementById('notificationsToggle');
        
        if (autoRefreshToggle) {
            autoRefreshToggle.checked = localStorage.getItem('autoRefresh') !== 'false';
            autoRefreshToggle.addEventListener('change', (e) => {
                localStorage.setItem('autoRefresh', e.target.checked);
            });
        }

        if (notificationsToggle) {
            notificationsToggle.checked = localStorage.getItem('notifications') === 'true';
            notificationsToggle.addEventListener('change', (e) => {
                localStorage.setItem('notifications', e.target.checked);
            });
        }
    }

    // Schedule functionality
    async loadSchedule() {
        try {
            console.log('📅 Loading schedule...');
            
            // Load both schedule and live data for correlation
            const [scheduleResponse, liveResponse] = await Promise.all([
                fetch(getAPIUrl('schedule')),
                fetch(getAPIUrl('live'))
            ]);
            
            const scheduleData = await scheduleResponse.json();
            const liveData = await liveResponse.json();
            
            // Update live train data if available
            if (liveData.success && liveData.data) {
                this.trainData.active = liveData.data;
            }
            
            if (scheduleData.success && scheduleData.data) {
                // Store schedule data for use in other methods
                this.scheduleData = scheduleData.data;
                this.populateSchedule(scheduleData.data);
                
                // Initialize search functionality
                this.initializeScheduleSearch();
            }
        } catch (error) {
            console.error('❌ Error loading schedule:', error);
        }
    }

    populateSchedule(schedule) {
        const container = document.getElementById('scheduleList');
        if (!container) return;

        let html = '';
        schedule.forEach(train => {
            // Get first and last station for route info
            const firstStation = train.stations && train.stations.length > 0 ? train.stations[0] : null;
            const lastStation = train.stations && train.stations.length > 0 ? train.stations[train.stations.length - 1] : null;
            
            const departureTime = firstStation && firstStation.DepartureTime ? this.formatTimeAMPM(firstStation.DepartureTime) : '--:--';
            const arrivalTime = lastStation && lastStation.ArrivalTime ? this.formatTimeAMPM(lastStation.ArrivalTime) : '--:--';
            const route = firstStation && lastStation ? `${firstStation.StationName} → ${lastStation.StationName}` : 'Route not available';
            
            // Find corresponding live train data matching direction
            const liveTrainData = this.findLiveTrainDataForSchedule(train.trainNumber, train.trainName, firstStation?.StationName, lastStation?.StationName);
            const isLive = !!liveTrainData;
            const trainId = train.trainId || train.trainNumber;
            const trainName = train.trainName || `Train ${train.trainNumber}`;
            
            // Get live data if available
            const speed = liveTrainData?.Speed || 0;

            // Calculate accurate delay from ETA if live data exists
            let delay = 0;
            if (liveTrainData) {
                const calculatedDelay = this.calculateDelayFromETA(liveTrainData);
                delay = calculatedDelay !== null ? calculatedDelay : (liveTrainData.LateBy || 0);
            }

            const currentStation = liveTrainData?.NextStation || firstStation?.StationName || 'Starting Station';
            const lastUpdated = liveTrainData ? this.formatLastUpdated(liveTrainData.LastUpdated) : 'Scheduled';
            const trainDate = liveTrainData ? this.getTrainDate(liveTrainData.LastUpdated, liveTrainData.InnerKey, liveTrainData.TrainNumber) : new Date().toLocaleDateString('en-GB', {day: '2-digit', month: '2-digit', year: 'numeric'});
            
            html += `
                <div class="train-card" onclick="mobileApp.openTrainScheduleDetails('${trainId}')">
                    <div class="train-card-header ${delay > 0 ? 'header-delayed' : 'header-ontime'}">
                        <div class="train-header-content">
                            <div class="train-name">${trainName}</div>
                        </div>
                        <div class="header-actions">
                            <button class="favorite-btn ${this.favoriteTrains.includes(train.trainNumber) ? 'favorited' : ''}" onclick="event.stopPropagation(); mobileApp.toggleFavorite('${train.trainNumber}')" title="${this.favoriteTrains.includes(train.trainNumber) ? 'Remove from favorites' : 'Add to favorites'}">
                                <span>${this.favoriteTrains.includes(train.trainNumber) ? '⭐' : '☆'}</span>
                            </button>
                            ${isLive ? `<button class="track-btn" onclick="event.stopPropagation(); mobileApp.openTrainDetails('${liveTrainData.InnerKey || liveTrainData.TrainId}')" title="Track Live">
                                📍 Track
                            </button>` : ''}
                        </div>
                    </div>
                    <div class="train-route">
                        <div class="train-number">#${train.trainNumber}</div>
                        <div class="train-route-arrow">→</div>
                        <div class="next-station">${route}</div>
                    </div>
                    
                    <!-- Schedule Information Section -->
                    <div class="info-section">
                        <div class="section-header">📅 Schedule Information</div>
                        <div class="train-info-grid">
                            <div class="info-row">
                                <span class="info-icon">🚉</span>
                                <span class="info-text">Origin: ${firstStation?.StationName || 'Unknown'}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-icon">🕒</span>
                                <span class="info-text">Departure: ${departureTime}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-icon">🏁</span>
                                <span class="info-text">Destination: ${lastStation?.StationName || 'Unknown'}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-icon">⏰</span>
                                <span class="info-text">Arrival: ${arrivalTime}</span>
                            </div>
                        </div>
                    </div>
                    
                    ${isLive ? `
                    <!-- Live Information Section -->
                    <div class="info-section live-section">
                        <div class="section-header">🔴 Live Information (${trainDate})</div>
                        <div class="train-info-grid">
                            <div class="info-row">
                                <span class="info-icon">📍</span>
                                <span class="info-text">Next Station: ${currentStation}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-icon">⏱️</span>
                                <span class="info-text">Delay: ${delay > 0 ? this.formatDelayDisplay(delay) : 'On Time'}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-icon">⚡</span>
                                <span class="info-text">Speed: ${speed} km/h</span>
                            </div>
                            <div class="info-row">
                                <span class="info-icon">🔄</span>
                                <span class="info-text">Updated: ${lastUpdated}</span>
                            </div>
                        </div>
                    </div>` : ''}
                    
                    <div class="train-status-row">
                        <div class="status-badge ${isLive ? (speed > 0 ? 'status-moving' : 'status-stopped') : 'status-scheduled'}">
                            ${isLive ? (speed > 0 ? 'Moving' : 'Stopped') : 'Scheduled'}
                        </div>
                        ${isLive ? `<div class="live-indicator">
                            <span class="live-dot"></span>
                            LIVE
                        </div>` : ''}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html || '<div class="empty-state">No schedule data available</div>';

        // Update results count
        const resultsCount = document.querySelector('#scheduleScreen .results-count');
        if (resultsCount) {
            const liveCount = schedule.filter(train => this.findLiveTrainData(train.trainNumber)).length;
            resultsCount.textContent = `${schedule.length} trains found (${liveCount} live)`;
        }

        this.updateFavoriteButtons();
        this.scheduleLastUpdatedTime = new Date();
    }

    initializeScheduleSearch() {
        const searchInput = document.getElementById('scheduleSearchInput');
        const clearBtn = document.getElementById('clearSearchBtn');
        
        if (searchInput) {
            // Real-time search as user types
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.trim();
                this.filterScheduleBySearch(query);
                
                // Show/hide clear button
                if (clearBtn) {
                    clearBtn.style.display = query ? 'flex' : 'none';
                }
            });
            
            // Clear search when Enter is pressed on empty input
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.target.value.trim()) {
                    this.clearScheduleSearch();
                }
            });
        }
    }
    
    filterScheduleBySearch(query) {
        if (!this.scheduleData) return;
        
        if (!query) {
            // Show all trains when search is empty
            this.populateSchedule(this.scheduleData);
            return;
        }
        
        const filteredTrains = this.scheduleData.filter(train => {
            const trainNumber = String(train.trainNumber || '').toLowerCase();
            const trainName = String(train.trainName || '').toLowerCase();
            
            // Get route information
            const firstStation = train.stations && train.stations.length > 0 ? train.stations[0] : null;
            const lastStation = train.stations && train.stations.length > 0 ? train.stations[train.stations.length - 1] : null;
            const route = firstStation && lastStation ? 
                `${firstStation.StationName} ${lastStation.StationName}`.toLowerCase() : '';
            
            const searchQuery = query.toLowerCase();
            
            return String(trainNumber).includes(searchQuery) || 
                   String(trainName).includes(searchQuery) || 
                   route.includes(searchQuery);
        });
        
        this.populateSchedule(filteredTrains);

        // Update results count
        const resultsCount = document.querySelector('#scheduleScreen .results-count');
        if (resultsCount) {
            const liveCount = filteredTrains.filter(train => this.findLiveTrainData(train.trainNumber)).length;
            resultsCount.textContent = `${filteredTrains.length} trains found (${liveCount} live)`;
        }
    }
    
    clearScheduleSearch() {
        const searchInput = document.getElementById('scheduleSearchInput');
        const clearBtn = document.getElementById('clearSearchBtn');
        
        if (searchInput) {
            searchInput.value = '';
        }
        if (clearBtn) {
            clearBtn.style.display = 'none';
        }
        
        // Show all trains
        if (this.scheduleData) {
            this.populateSchedule(this.scheduleData);
        }
    }

    // Helper functions for live train integration
    findLiveTrainData(trainNumber) {
        if (!this.trainData.active) return null;
        
        // Find all matching trains for this train number
        const matchingTrains = this.trainData.active.filter(train => 
            String(train.TrainNumber) === String(trainNumber) ||
            String(train.TrainName).toLowerCase().includes(String(trainNumber).toLowerCase())
        );

        if (matchingTrains.length === 0) return null;
        if (matchingTrains.length === 1) return matchingTrains[0];

        // Sort by date (most recent first) using InnerKey
        matchingTrains.sort((a, b) => {
            const dateA = this.extractDateFromInnerKey(a.InnerKey, a.TrainNumber);
            const dateB = this.extractDateFromInnerKey(b.InnerKey, b.TrainNumber);
            
            if (dateA && dateB) {
                return dateB.sortKey.localeCompare(dateA.sortKey); // Most recent first
            }
            return 0;
        });

        // Return the most recent train
        return matchingTrains[0];
    }

    // Find live train data that matches the schedule train's direction and route
    findLiveTrainDataForSchedule(trainNumber, scheduledTrainName, originStation, destinationStation) {
        if (!this.trainData.active) return null;
        
        // Find all matching trains for this train number
        const matchingTrains = this.trainData.active.filter(train => 
            String(train.TrainNumber) === String(trainNumber)
        );

        if (matchingTrains.length === 0) return null;
        if (matchingTrains.length === 1) return matchingTrains[0];

        console.log(`🔍 Found ${matchingTrains.length} live instances for train #${trainNumber}, matching with schedule: ${scheduledTrainName}`);

        // Try to match by train name direction (UP/DN)
        const scheduleDirection = scheduledTrainName?.toUpperCase().includes('DN') || scheduledTrainName?.toUpperCase().includes('DOWN') ? 'DN' : 'UP';
        
        const directionMatches = matchingTrains.filter(train => {
            const liveTrainName = train.TrainName || '';
            const liveDirection = liveTrainName.toUpperCase().includes('DN') || liveTrainName.toUpperCase().includes('DOWN') ? 'DN' : 'UP';
            return liveDirection === scheduleDirection;
        });

        console.log(`  Schedule direction: ${scheduleDirection}, Found ${directionMatches.length} matching direction`);

        // Use direction matches if we have any, otherwise use all matches
        const trainsToSort = directionMatches.length > 0 ? directionMatches : matchingTrains;

        // Sort by date (most recent first) using InnerKey
        trainsToSort.sort((a, b) => {
            const dateA = this.extractDateFromInnerKey(a.InnerKey, a.TrainNumber);
            const dateB = this.extractDateFromInnerKey(b.InnerKey, b.TrainNumber);
            
            if (dateA && dateB) {
                return dateB.sortKey.localeCompare(dateA.sortKey); // Most recent first
            }
            return 0;
        });

        const selectedTrain = trainsToSort[0];
        console.log(`  ✅ Selected: ${selectedTrain?.TrainName} (${selectedTrain?.InnerKey})`);

        return selectedTrain;
    }

    generateLiveInfo(liveTrainData) {
        if (!liveTrainData) {
            return {
                statusBadge: '<div class="schedule-status-badge offline">Offline</div>',
                liveDetails: ''
            };
        }

        const speed = liveTrainData.Speed || 0;
        const delay = liveTrainData.LateBy || 0;
        const location = liveTrainData.NextStation || 'Location updating...';
        
        let statusClass = 'live';
        let statusText = 'LIVE';
        let statusColor = '#10B981';
        
        if (delay > 15) {
            statusClass = 'delayed';
            statusText = this.formatDelayDisplay(delay).replace(' Late', '');
            statusColor = '#EF4444';
        } else if (delay > 5) {
            statusClass = 'late';
            statusText = this.formatDelayDisplay(delay).replace(' Late', '');
            statusColor = '#F59E0B';
        }

        const liveDetails = `
            <div class="live-train-info">
                <div class="live-info-item">
                    <span class="live-icon">📍</span>
                    <span class="live-text">${location}</span>
                </div>
                <div class="live-info-item">
                    <span class="live-icon">⚡</span>
                    <span class="live-text">${speed} km/h</span>
                </div>
                ${delay ? `<div class="live-info-item delay">
                    <span class="live-icon">⏰</span>
                    <span class="live-text">${this.formatDelayDisplay(delay)}</span>
                </div>` : ''}
            </div>
        `;

        return {
            statusBadge: `<div class="schedule-status-badge ${statusClass}" style="background: ${statusColor};">${statusText}</div>`,
            liveDetails: liveDetails
        };
    }

    openLiveTrainFromSchedule(trainNumber) {
        console.log('🚂 Opening live train from schedule:', trainNumber);
        const liveTrainData = this.findLiveTrainData(trainNumber);
        
        if (liveTrainData) {
            const trainId = liveTrainData.InnerKey || liveTrainData.TrainId || liveTrainData.TrainNumber;
            this.openTrainDetails(trainId);
        } else {
            alert('Live tracking data not available for this train');
        }
    }

    openTrainScheduleDetails(trainId) {
        console.log('📅 Opening schedule details for train:', trainId);
        this.navigateToScreen('scheduleDetailsScreen');
        this.loadTrainScheduleDetails(trainId);
    }

    async loadTrainScheduleDetails(trainId) {
        try {
            console.log('🚂 Loading schedule details for train:', trainId);
            
            // First try to get the train data from the schedule list
            let trainData = null;
            
            // Check if we have the train in our current schedule data
            const scheduleContainer = document.getElementById('scheduleList');
            if (scheduleContainer) {
                // Find the train in our loaded schedule data
                const response = await fetch(getAPIUrl('schedule'));
                const data = await response.json();
                
                if (data.success && data.data) {
                    trainData = data.data.find(train => 
                        String(train.trainId) === String(trainId) ||
                        String(train.trainNumber) === String(trainId) ||
                        String(train.TrainNumber) === String(trainId)
                    );
                }
            }

            if (!trainData) {
                // Try to fetch individual train details
                const trainResponse = await fetch(getAPIPath(`/api/train/${trainId}`));
                const trainInfo = await trainResponse.json();
                
                if (trainInfo.success && trainInfo.data) {
                    trainData = trainInfo.data;
                }
            }

            if (trainData) {
                this.populateScheduleDetails(trainData);
            } else {
                this.showScheduleDetailsError(`Train ${trainId} not found`);
            }

        } catch (error) {
            console.error('❌ Error loading schedule details:', error);
            this.showScheduleDetailsError(error.message);
        }
    }

    populateScheduleDetails(trainData) {
        // Update train basic info
        document.getElementById('scheduleTrainName').textContent = trainData.trainName || trainData.TrainName || 'Unknown Train';
        document.getElementById('scheduleTrainNumber').textContent = trainData.trainNumber || trainData.TrainNumber || '--';

        // Get first and last stations for route overview
        const stations = trainData.stations || [];
        if (stations.length > 0) {
            const firstStation = stations[0];
            const lastStation = stations[stations.length - 1];

            document.getElementById('scheduleOrigin').textContent = firstStation.StationName || 'Origin';
            const depTime = firstStation.DepartureTime || firstStation.ArrivalTime || '--:--';
            document.getElementById('scheduleDepartureTime').textContent = depTime !== '--:--' ? this.formatTimeAMPM(depTime) : depTime;
            
            document.getElementById('scheduleDestination').textContent = lastStation.StationName || 'Destination';
            const arrTime = lastStation.ArrivalTime || lastStation.DepartureTime || '--:--';
            document.getElementById('scheduleArrivalTime').textContent = arrTime !== '--:--' ? this.formatTimeAMPM(arrTime) : arrTime;

            // Calculate journey duration and total distance
            if (firstStation.DepartureTime && lastStation.ArrivalTime) {
                const duration = this.calculateJourneyDuration(
                    firstStation.DepartureTime, 
                    lastStation.ArrivalTime,
                    firstStation.DayCount || 0,
                    lastStation.DayCount || 0
                );
                const totalDistance = lastStation.DistanceFromOrigin;
                
                let durationText = duration;
                if (totalDistance) {
                    durationText += ` • ${totalDistance} km`;
                }
                document.getElementById('journeyDuration').textContent = durationText;
            }

            // Populate all stations
            this.populateScheduleStations(stations);
        }

    }

    populateScheduleStations(stations) {
        const container = document.getElementById('scheduleStationList');
        if (!container) return;

        let html = '';
        
        stations.forEach((station, index) => {
            const isFirst = index === 0;
            const isLast = index === stations.length - 1;
            
            let statusClass = 'upcoming';
            let icon = index + 1;
            
            if (isFirst) {
                statusClass = 'origin';
                icon = '🚉';
            } else if (isLast) {
                statusClass = 'destination';
                icon = '🏁';
            }

            const arrivalTime = station.ArrivalTime ? this.formatTimeAMPM(station.ArrivalTime) : '--:--';
            const departureTime = station.DepartureTime ? this.formatTimeAMPM(station.DepartureTime) : '--:--';
            const platform = station.Platform;

            html += `
                <div class="route-station-item ${statusClass}">
                    <div class="station-status-dot">${icon}</div>
                    <div class="station-main-info">
                        <div class="station-name">${station.StationName || 'Station'}</div>
                        <div class="station-details-row">
                            ${isFirst ?
                                (departureTime !== '--:--' ? `<span class="station-time">Dep: ${departureTime}</span>` : '') :
                                isLast ?
                                    (arrivalTime !== '--:--' ? `<span class="station-time">Arr: ${arrivalTime}</span>` : '') :
                                    `${arrivalTime !== '--:--' ? `<span class="station-time">Arr: ${arrivalTime}</span>` : ''}
                                     ${departureTime !== '--:--' ? `<span class="station-time">Dep: ${departureTime}</span>` : ''}`
                            }
                        </div>
                    </div>
                    <div class="station-meta-info">
                        ${station.DistanceFromOrigin ? `<div class="station-distance">${parseFloat(station.DistanceFromOrigin).toFixed(2)} km</div>` : ''}
                        ${platform ? `<div class="station-platform">Platform ${platform}</div>` : ''}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    calculateJourneyDuration(startTime, endTime, startDayCount = 0, endDayCount = 0) {
        try {
            console.log('🕐 Journey Duration Calculation:', { startTime, endTime, startDayCount, endDayCount });
            
            // Parse 24-hour format times (HH:MM:SS or HH:MM)
            const parseTime = (timeStr) => {
                const parts = timeStr.split(':');
                return {
                    hours: parseInt(parts[0]) || 0,
                    minutes: parseInt(parts[1]) || 0
                };
            };

            const start = parseTime(startTime);
            const end = parseTime(endTime);
            console.log('🕐 Parsed times:', { start, end });

            // Convert to minutes for easier calculation
            const startMinutes = start.hours * 60 + start.minutes;
            let endMinutes = end.hours * 60 + end.minutes;
            console.log('🕐 Minutes before day adjustment:', { startMinutes, endMinutes });
            
            // Add day difference in minutes (24 hours = 1440 minutes per day)
            const dayDifference = endDayCount - startDayCount;
            if (dayDifference > 0) {
                endMinutes += dayDifference * 24 * 60; // Add days worth of minutes
                console.log('🕐 Day difference detected:', { dayDifference, endMinutesAfterDayAdjustment: endMinutes });
            }
            
            const totalMinutes = endMinutes - startMinutes;
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            
            console.log('🕐 Final calculation:', { totalMinutes, hours, minutes, result: `${hours}h ${minutes}m` });
            
            return `${hours}h ${minutes}m`;
        } catch (error) {
            console.error('Error calculating journey duration:', error);
            return '-- hours';
        }
    }

    showScheduleDetailsError(message) {
        document.getElementById('scheduleTrainName').textContent = 'Error Loading Schedule';
        document.getElementById('scheduleStationList').innerHTML = `<div class="loading">Error: ${message}</div>`;
    }

    // Dark mode functionality
    initializeDarkMode() {
        const isDarkMode = localStorage.getItem('darkMode') === 'true';
        if (isDarkMode) {
            document.body.classList.add('dark-mode');
            this.updateDarkModeIcon(true);
        }
    }

    toggleDarkMode() {
        const body = document.body;
        const isDarkMode = body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', isDarkMode);
        this.updateDarkModeIcon(isDarkMode);
        console.log('🌙 Dark mode:', isDarkMode ? 'enabled' : 'disabled');
    }

    // Live Updates functionality
    async loadLiveUpdates() {
        try {
            console.log('📅 Loading live updates...');
            
            // Use the already filtered train data from loadLiveTrains()
            // This ensures we use the same filtering logic (duplicates, completed journeys, unrealistic delays, etc.)
            if (!this.trainData || !this.trainData.active || this.trainData.active.length === 0) {
                console.log('⚠️ No filtered train data available, fetching...');
                await this.loadLiveTrains();
            }
            
            console.log('📊 Using filtered train data:', this.trainData.active.length, 'trains');
            
            if (this.trainData.active && this.trainData.active.length > 0) {
                this.populateLiveUpdates(this.trainData.active);
                console.log('📡 Live updates loaded successfully from filtered data');
            } else {
                console.log('❌ No train data available');
                this.showLiveUpdatesError();
            }
        } catch (error) {
            console.error('❌ Error loading live updates:', error);
            this.showLiveUpdatesError();
        }
    }

    populateLiveUpdates(liveTrains) {
        console.log('🔄 populateLiveUpdates called with:', liveTrains?.length || 0, 'trains');
        const container = document.getElementById('liveUpdatesFeed');
        if (!container) {
            console.log('❌ Live updates container not found');
            return;
        }

        if (!liveTrains || liveTrains.length === 0) {
            console.log('❌ No live trains data available');
            container.innerHTML = '<div class="no-updates">No live trains available</div>';
            return;
        }

        // Filter to only show passenger trains (exclude freight trains)
        liveTrains = liveTrains.filter(train => {
            const trainName = String(train.TrainName || train.trainName || '').toUpperCase();
            
            // Exclude freight trains and engines (contain 'FREIGHT', 'FRT', 'GOODS', 'CARGO', 'ENGINE NO', 'ENG NUM' in name)
            const isFreight = trainName.includes('FREIGHT') || 
                            trainName.includes('FRT') || 
                            trainName.includes('GOODS') ||
                            trainName.includes('CARGO') ||
                            trainName.includes('ENGINE NO') ||
                            trainName.includes('ENG NUM');
            
            return !isFreight; // Only include non-freight (passenger) trains
        });

        console.log(`📊 Filtered to ${liveTrains.length} passenger trains`);

        if (liveTrains.length === 0) {
            console.log('❌ No passenger trains available');
            container.innerHTML = '<div class="no-updates">No passenger trains available</div>';
            return;
        }

        // Always include all favorite trains first, then add most recent trains
        console.log('📊 Preparing trains for live updates...');

        // Get all favorite trains and keep only the most recent instance of each
        const favoriteTrainsByNumber = {};
        liveTrains.forEach(train => {
            const trainNumber = String(train.TrainNumber || train.trainNumber);
            if (this.isFavorite(trainNumber)) {
                if (!favoriteTrainsByNumber[trainNumber]) {
                    favoriteTrainsByNumber[trainNumber] = [];
                }
                favoriteTrainsByNumber[trainNumber].push(train);
            }
        });

        // For each favorite train number, get the most recent instance
        const allFavoriteTrains = [];
        Object.entries(favoriteTrainsByNumber).forEach(([trainNumber, trains]) => {
            // Sort by InnerKey date (actual train journey date) and take the most recent
            const sorted = trains.sort((a, b) => {
                const dateA = this.extractDateFromInnerKey(a.InnerKey, a.TrainNumber);
                const dateB = this.extractDateFromInnerKey(b.InnerKey, b.TrainNumber);
                
                if (dateA && dateB) {
                    return dateB.sortKey.localeCompare(dateA.sortKey); // Most recent first
                }
                
                // Fallback to LastUpdated if InnerKey extraction fails
                const timeA = new Date(a.LastUpdated || Date.now());
                const timeB = new Date(b.LastUpdated || Date.now());
                return timeB - timeA;
            });
            const mostRecent = sorted[0];
            const trainDate = this.getTrainDate(mostRecent.LastUpdated, mostRecent.InnerKey, mostRecent.TrainNumber);
            console.log(`  ⭐ Selected favorite train ${trainNumber} - ${mostRecent.TrainName || 'Unknown'} (${trainDate}) InnerKey: ${mostRecent.InnerKey} NextStation: ${mostRecent.NextStation} [${trains.length} instances available]`);
            allFavoriteTrains.push(mostRecent); // Take the most recent
        });

        console.log('⭐ Most recent favorite trains selected:', allFavoriteTrains.length);

        // Sort remaining non-favorite trains by most recent train date
        const nonFavoriteTrains = liveTrains.filter(train => {
            const trainNumber = String(train.TrainNumber || train.trainNumber);
            return !this.isFavorite(trainNumber);
        });

        const sortedNonFavorites = [...nonFavoriteTrains].sort((a, b) => {
            // Use InnerKey for accurate train date comparison
            const dateA = this.extractDateFromInnerKey(a.InnerKey, a.TrainNumber);
            const dateB = this.extractDateFromInnerKey(b.InnerKey, b.TrainNumber);
            
            // If both have valid InnerKey dates, sort by that
            if (dateA && dateB) {
                return dateB.sortKey.localeCompare(dateA.sortKey); // Most recent first
            }
            
            // Fallback to LastUpdated for trains without valid InnerKey
            const timeA = new Date(a.LastUpdated || a.__last_updated || a.last_updated || a.UpdateTime || a.updateTime || Date.now());
            const timeB = new Date(b.LastUpdated || b.__last_updated || b.last_updated || b.UpdateTime || b.updateTime || Date.now());

            // Handle invalid dates by putting them at the end
            const timeAValid = !isNaN(timeA.getTime()) && timeA.getFullYear() !== 1970;
            const timeBValid = !isNaN(timeB.getTime()) && timeB.getFullYear() !== 1970;

            if (timeAValid && !timeBValid) return -1;
            if (!timeAValid && timeBValid) return 1;
            if (!timeAValid && !timeBValid) return 0;

            return timeB - timeA; // Most recent train date first
        });

        // Combine: ALL favorites + top 15 most recent non-favorites
        const todayLiveTrains = [...allFavoriteTrains, ...sortedNonFavorites.slice(0, 15)];
        
        console.log('📅 Trains passed to relevance filter:', todayLiveTrains.length, '(including', allFavoriteTrains.length, 'favorites)');

        // Get relevant trains based on user location and favorites
        const relevantTrains = this.getRelevantTrainsForLiveUpdates(todayLiveTrains);
        
        console.log('🎯 Relevant trains found:', relevantTrains.length);

        if (relevantTrains.length === 0) {
            container.innerHTML = '<div class="no-updates">No relevant trains near your location</div>';
            return;
        }

        // Show up to 5 most relevant trains
        const combinedTrains = relevantTrains.slice(0, 5);

        let html = '';
        combinedTrains.forEach(train => {
            const trainName = train.TrainName || train.trainName || `Train ${train.TrainNumber}`;
            const trainNumber = String(train.TrainNumber || train.trainNumber);
            // Try multiple fields for current station
            const currentStation = train.CurrentStation || train.currentStation ||
                                   train.NextStation || train.nextStation ||
                                   train.LastStation || train.lastStation ||
                                   'En route';

            // Calculate accurate delay from ETA
            const calculatedDelay = this.calculateDelayFromETA(train);
            const delay = calculatedDelay !== null ? calculatedDelay : (train.LateBy || train.lateBy || 0);

            const updateTime = this.getRelativeTime(train.UpdateTime || train.updateTime);

            // Calculate ETA for next station
            const eta = this.calculateTrainETA(train);

            // Get meaningful train info - just show next station
            const currentLocation = currentStation;
            const nextStation = train.NextStation || train.nextStation || currentLocation;
            const routeInfo = `Next station - ${nextStation}`;
            
            // Determine status class and message
            let statusClass = 'on-time';
            let statusMessage = 'On time';
            let actionText = 'Running on schedule';
            
            if (delay > 0) {
                statusClass = 'delayed';
                statusMessage = this.formatDelayDisplay(delay); // Already includes 'Late'
                actionText = `Running behind schedule`;
            }

            // Create update message
            let updateMessage = `At ${currentStation}`;
            if (train.Status && train.Status.toLowerCase().includes('departed')) {
                actionText = `Departed from ${currentLocation}`;
            } else if (train.Status && train.Status.toLowerCase().includes('arrived')) {
                actionText = `Arrived at ${currentLocation}`;
            } else if (train.Speed > 5 && nextStation) {
                actionText = `En route to ${nextStation}`;
            }

            const isFavorite = this.isFavorite(trainNumber);
            
            // Determine train direction - improved logic
            const trainNameUp = trainName.toUpperCase();
            const trainNumberUp = trainNumber.toUpperCase();
            let direction = '';
            
            // Check both train name and train number for UP/DOWN indicators
            if (trainNameUp.includes('UP') || trainNumberUp.includes('UP')) {
                direction = 'UP';
            } else if (trainNameUp.includes('DOWN') || trainNameUp.includes('DN') || 
                       trainNumberUp.includes('DOWN') || trainNumberUp.includes('DN')) {
                direction = 'DOWN';
            } else {
                // Fallback to train number parity only if no text indicators
                const numericPart = parseInt(trainNumber.replace(/\D/g, ''));
                if (!isNaN(numericPart)) {
                    direction = (numericPart % 2 === 0) ? 'UP' : 'DOWN';
                }
            }
            
            html += `
                <div class="update-item ${isFavorite ? 'is-favorite' : ''}" onclick="mobileApp.openTrainDetails('${train.InnerKey || train.TrainId || trainNumber}')">
                    <div class="update-status ${statusClass}"></div>
                    <div class="update-content">
                        <div class="update-title">
                            ${isFavorite ? '⭐ ' : ''}${trainName}
                            ${direction ? `<span class="direction-badge">${direction}</span>` : ''}
                        </div>
                        <div class="update-details">${updateTime === 'Unknown' || updateTime === 'No recent update' ? routeInfo : actionText}</div>
                        <div class="update-meta">
                            <div class="update-time">${updateTime === 'Unknown' || updateTime === 'No recent update' ? `Last updated: ${train.LastUpdated ? new Date(train.LastUpdated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true}) : 'N/A'}` : updateTime}</div>
                            <div class="update-eta">${eta}</div>
                        </div>
                        ${delay > 0 ? `<div class="update-delay">${statusMessage}</div>` : ''}
                    </div>
                </div>
            `;
        });

        if (html === '') {
            html = '<div class="no-updates">No recent updates available</div>';
        }

        container.innerHTML = html;
    }

    getRelevantTrainsForLiveUpdates(liveTrains) {
        const seenTrainNumbers = new Set();
        const relevantTrains = [];

        // Helper function to add unique trains
        const addUniqueTrains = (trains, label) => {
            let added = 0;
            trains.forEach(train => {
                const trainNumber = String(train.TrainNumber || train.trainNumber);
                if (!seenTrainNumbers.has(trainNumber)) {
                    seenTrainNumbers.add(trainNumber);
                    relevantTrains.push(train);
                    added++;
                }
            });
            console.log(`${label} added:`, added, `(unique) - Total now: ${relevantTrains.length}`);
        };

        // 1. PRIORITY: Show nearest favorited train to user's location
        console.log('⭐ Stored favorite train numbers:', this.favoriteTrains);
        const favoriteTrains = liveTrains.filter(train => {
            const trainNumber = String(train.TrainNumber || train.trainNumber);
            const isFav = this.isFavorite(trainNumber);
            if (isFav) {
                console.log(`  ✓ Found favorite train ${trainNumber} - ${train.TrainName || 'Unknown'}`);
            }
            return isFav;
        });

        console.log('⭐ Favorite trains found in data:', favoriteTrains.length);
        
        // If user has location and favorite trains exist, show nearest favorite train ONLY
        if (this.userLocation && favoriteTrains.length > 0) {
            console.log('📍 User location available - finding nearest favorite train');
            
            // Calculate distance for each favorite train
            const favoritesWithDistance = favoriteTrains.map(train => {
                const distance = this.calculateDistance(
                    this.userLocation.latitude,
                    this.userLocation.longitude,
                    train.Latitude || train.latitude,
                    train.Longitude || train.longitude
                );
                return { train, distance };
            }).filter(item => !isNaN(item.distance));
            
            console.log(`📊 Favorites with valid coordinates: ${favoritesWithDistance.length} out of ${favoriteTrains.length}`);
            
            if (favoritesWithDistance.length > 0) {
                // Sort by distance (nearest first)
                favoritesWithDistance.sort((a, b) => a.distance - b.distance);
                
                const nearestFavorite = favoritesWithDistance[0].train;
                const trainNumber = String(nearestFavorite.TrainNumber || nearestFavorite.trainNumber);
                console.log(`🎯 Nearest favorite train: ${trainNumber} - ${nearestFavorite.TrainName} (${favoritesWithDistance[0].distance.toFixed(1)} km away)`);
                seenTrainNumbers.add(trainNumber);
                relevantTrains.push(nearestFavorite);
                console.log('⭐ Showing 1 nearest favorite train');
            } else {
                // Fallback: If no favorite trains have valid coordinates, show most recent trains from favorites
                console.log('⚠️ No favorite trains with valid coordinates - showing most recent instances of all favorites');
                addUniqueTrains(favoriteTrains, '⭐ All favorite trains');
            }
        } else if (favoriteTrains.length > 0) {
            // If no user location, show most recent trains from all favorites
            console.log('📍 No user location - showing most recent instances of all favorites');
            addUniqueTrains(favoriteTrains, '⭐ All favorite trains');
        } else {
            console.log('⭐ No favorite trains found in filtered data');
        }

        // 2. If user has location, add location-based trains (non-favorites)
        if (this.nearestStation) {
            console.log('📍 User nearest station:', this.nearestStation.name);

            const locationBasedTrains = this.getLocationBasedTrains(liveTrains);
            console.log('🗺️ Location-based trains found:', locationBasedTrains.length);
            addUniqueTrains(locationBasedTrains, '🗺️ Location-based');
        }

        // 3. Fill up to 5 trains with most recent trains
        if (relevantTrains.length < 5) {
            console.log('📊 Filling up to 5 trains (current:', relevantTrains.length, ')');

            // Group trains by number and get most recent for each
            const trainGroups = {};
            liveTrains.forEach(train => {
                const trainNumber = String(train.TrainNumber || train.trainNumber);
                if (!trainGroups[trainNumber]) {
                    trainGroups[trainNumber] = [];
                }
                trainGroups[trainNumber].push(train);
            });

            const sortedTrains = [];
            Object.values(trainGroups).forEach(trains => {
                // Sort this train number's instances by train date (LastUpdated)
                const sortedGroup = trains.sort((a, b) => {
                    const timeA = new Date(a.LastUpdated || a.__last_updated || a.last_updated || a.UpdateTime || a.updateTime || Date.now());
                    const timeB = new Date(b.LastUpdated || b.__last_updated || b.last_updated || b.UpdateTime || b.updateTime || Date.now());
                    return timeB - timeA; // Most recent first
                });

                // Take the most recent train for each train number
                const selectedTrain = sortedGroup[0];
                sortedTrains.push(selectedTrain);
            });

            // Sort the selected trains by their train dates
            sortedTrains.sort((a, b) => {
                const timeA = new Date(a.LastUpdated || a.__last_updated || a.last_updated || a.UpdateTime || a.updateTime || Date.now());
                const timeB = new Date(b.LastUpdated || b.__last_updated || b.last_updated || b.UpdateTime || b.updateTime || Date.now());
                return timeB - timeA; // Most recent first
            });

            // Add trains until we reach 5
            const needed = 5 - relevantTrains.length;
            console.log('📊 Need', needed, 'more trains to reach 5');
            addUniqueTrains(sortedTrains.slice(0, needed), '📊 Recent');
        }

        // Sort by priority: favorites first, then by train date (most recent)
        console.log('🔄 Sorting relevant trains, total count:', relevantTrains.length);
        relevantTrains.sort((a, b) => {
            const aNumber = String(a.TrainNumber || a.trainNumber);
            const bNumber = String(b.TrainNumber || b.trainNumber);
            const aIsFavorite = this.isFavorite(aNumber);
            const bIsFavorite = this.isFavorite(bNumber);

            // Favorites always come first
            if (aIsFavorite && !bIsFavorite) return -1;
            if (!aIsFavorite && bIsFavorite) return 1;

            // For trains with same favorite status, sort by train date (LastUpdated)
            const timeA = new Date(a.LastUpdated || a.__last_updated || a.last_updated || a.UpdateTime || a.updateTime || Date.now());
            const timeB = new Date(b.LastUpdated || b.__last_updated || b.last_updated || b.UpdateTime || b.updateTime || Date.now());

            // Handle invalid dates
            const timeAValid = !isNaN(timeA.getTime()) && timeA.getFullYear() !== 1970;
            const timeBValid = !isNaN(timeB.getTime()) && timeB.getFullYear() !== 1970;

            if (timeAValid && !timeBValid) return -1;
            if (!timeAValid && timeBValid) return 1;
            if (!timeAValid && !timeBValid) return 0;

            return timeB - timeA; // Most recent first
        });

        // Log final order for debugging
        console.log('✅ Final sorted trains:');
        relevantTrains.forEach((train, index) => {
            const trainNumber = String(train.TrainNumber || train.trainNumber);
            const isFav = this.isFavorite(trainNumber);
            console.log(`  ${index + 1}. Train ${trainNumber} - ${train.TrainName || 'Unknown'} ${isFav ? '⭐' : ''}`);
        });

        return relevantTrains;
    }

    getLocationBasedTrains(liveTrains) {
        if (!this.nearestStation) return [];

        const currentStationName = this.nearestStation.name.toLowerCase();
        const locationBasedTrains = [];

        console.log(`📍 Searching for trains at: ${currentStationName}`);

        // Find trains at current station only
        liveTrains.forEach(train => {
            const trainCurrentStation = (train.CurrentStation || train.NextStation || train.LastStation || '').toLowerCase();
            const trainNextStation = (train.NextStation || '').toLowerCase();
            const trainNumber = String(train.TrainNumber || train.trainNumber);
            const trainName = (train.TrainName || train.trainName || '').toUpperCase();

            // Determine train direction (UP/DOWN)
            let isUpTrain = false;
            let isDownTrain = false;

            // Check train name and number for UP/DOWN indicators
            if (String(trainName).includes('UP') || String(trainNumber).includes('UP')) {
                isUpTrain = true;
            } else if (String(trainName).includes('DOWN') || String(trainName).includes('DN') ||
                       String(trainNumber).includes('DOWN') || String(trainNumber).includes('DN')) {
                isDownTrain = true;
            } else {
                // Fallback to train number parity
                const numericPart = parseInt(trainNumber.replace(/\D/g, ''));
                if (!isNaN(numericPart)) {
                    isUpTrain = (numericPart % 2 === 0);
                    isDownTrain = (numericPart % 2 === 1);
                }
            }

            // Check if train is at/near current station or next station
            const isAtCurrentStation = trainCurrentStation.includes(currentStationName) ||
                                     currentStationName.includes(trainCurrentStation) ||
                                     trainNextStation.includes(currentStationName) ||
                                     currentStationName.includes(trainNextStation);

            if (isAtCurrentStation) {
                console.log(`🚂 Found train ${trainNumber} (${isUpTrain ? 'UP' : isDownTrain ? 'DOWN' : 'UNKNOWN'}) at/near ${currentStationName}`);
                locationBasedTrains.push(train);
            }
        });

        return locationBasedTrains;
    }


    showLiveUpdatesError() {
        const container = document.getElementById('liveUpdatesFeed');
        if (!container) return;
        
        console.log('🔄 Loading sample live updates as fallback');
        
        // Show sample updates
        container.innerHTML = `
            <div class="update-item">
                <div class="update-status on-time"></div>
                <div class="update-content">
                    <div class="update-title">Karachi Express</div>
                    <div class="update-details">Running on schedule</div>
                    <div class="update-time">2 minutes ago</div>
                </div>
            </div>
            <div class="update-item">
                <div class="update-status delayed"></div>
                <div class="update-content">
                    <div class="update-title">Green Line Express</div>
                    <div class="update-details">Running 15 minutes late</div>
                    <div class="update-time">5 minutes ago</div>
                </div>
            </div>
            <div class="update-item">
                <div class="update-status arrived"></div>
                <div class="update-content">
                    <div class="update-title">Business Express</div>
                    <div class="update-details">Arrived at destination</div>
                    <div class="update-time">8 minutes ago</div>
                </div>
            </div>
        `;
    }

    getRelativeTime(timestamp) {
        if (!timestamp) return 'Unknown';
        
        try {
            const now = new Date();
            const updateTime = new Date(timestamp);
            
            // Check if the date is invalid (epoch time or null)
            if (isNaN(updateTime.getTime()) || updateTime.getTime() === 0 || updateTime.getFullYear() === 1970) {
                return 'No recent update';
            }
            
            const diffMs = now - updateTime;
            const diffMins = Math.floor(diffMs / (1000 * 60));
            
            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
            
            const diffHours = Math.floor(diffMins / 60);
            if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
            
            const diffDays = Math.floor(diffHours / 24);
            return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        } catch (error) {
            return 'No recent update';
        }
    }

    // Geolocation and nearest station functionality
    getUserLocation() {
        if (!navigator.geolocation) {
            console.log('Geolocation not supported');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                console.log('📍 User location obtained:', this.userLocation);
                this.findNearestStation();
            },
            (error) => {
                console.log('Location access denied or failed:', error.message);
                // Try to use a fallback location (Karachi as default)
                this.userLocation = { lat: 24.8607, lng: 67.0011 }; // Karachi
                this.findNearestStation();
            },
            {
                timeout: 10000,
                maximumAge: 300000 // 5 minutes
            }
        );
    }

    async findNearestStation() {
        if (!this.userLocation) return;
        
        try {
            // Get all stations from schedule data
            let allStations = [];
            if (this.scheduleData && this.scheduleData.length > 0) {
                this.scheduleData.forEach(train => {
                    if (train.stations && train.stations.length > 0) {
                        train.stations.forEach(station => {
                            if (station.Latitude && station.Longitude && station.StationName) {
                                const existingStation = allStations.find(s => s.name === station.StationName);
                                if (!existingStation) {
                                    allStations.push({
                                        name: station.StationName,
                                        lat: parseFloat(station.Latitude),
                                        lng: parseFloat(station.Longitude)
                                    });
                                }
                            }
                        });
                    }
                });
            }

            if (allStations.length === 0) {
                console.log('No station data available for location matching');
                return;
            }

            // Calculate distance to each station
            let nearestStation = null;
            let minDistance = Infinity;

            allStations.forEach(station => {
                const distance = this.calculateDistance(
                    this.userLocation.lat, this.userLocation.lng,
                    station.lat, station.lng
                );
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestStation = { ...station, distance };
                }
            });

            this.nearestStation = nearestStation;
            if (nearestStation) {
                console.log(`📍 Nearest station: ${nearestStation.name} (${Math.round(nearestStation.distance)} km away)`);
                // Refresh live updates to show location-based content
                this.loadLiveUpdates();
            }
        } catch (error) {
            console.error('Error finding nearest station:', error);
        }
    }

    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // Favorites functionality
    loadFavoritesFromStorage() {
        try {
            const favorites = localStorage.getItem('favoriteTrains');
            return favorites ? JSON.parse(favorites) : [];
        } catch (error) {
            console.error('Error loading favorites:', error);
            return [];
        }
    }

    saveFavorites() {
        try {
            localStorage.setItem('favoriteTrains', JSON.stringify(this.favoriteTrains));
        } catch (error) {
            console.error('Error saving favorites:', error);
        }
    }

    toggleFavorite(trainNumber) {
        console.log('🔄 toggleFavorite called for train:', trainNumber);
        console.log('📋 Current favorites before:', this.favoriteTrains);
        
        const index = this.favoriteTrains.indexOf(String(trainNumber));
        if (index > -1) {
            this.favoriteTrains.splice(index, 1);
            console.log(`❌ Removed ${trainNumber} from favorites`);
            this.showToast('Removed from favorites');
        } else {
            this.favoriteTrains.push(String(trainNumber));
            console.log(`⭐ Added ${trainNumber} to favorites`);
            this.showToast('Added to favorites');
        }
        
        console.log('📋 Current favorites after:', this.favoriteTrains);

        this.saveFavorites();

        // Instantly refresh UI
        this.updateFavoriteButtons();
        this.loadLiveUpdates(); // Refresh to show favorite trains

        // Reload favorites screen if currently viewing it
        const currentScreen = document.querySelector('.screen.active');
        if (currentScreen && currentScreen.id === 'favoritesScreen') {
            this.loadFavorites();
        }
    }

    isFavorite(trainNumber) {
        return this.favoriteTrains.includes(String(trainNumber));
    }

    updateFavoriteButtons() {
        // Update favorite buttons on train cards
        document.querySelectorAll('.favorite-btn').forEach(btn => {
            const trainNumber = btn.dataset.trainNumber;
            const onclick = btn.getAttribute('onclick');
            
            // Extract train number from onclick attribute if not in dataset
            let extractedTrainNumber = trainNumber;
            if (!extractedTrainNumber && onclick) {
                const match = onclick.match(/toggleFavorite\('([^']+)'\)/);
                if (match) {
                    extractedTrainNumber = match[1];
                }
            }
            
            if (extractedTrainNumber && this.isFavorite(extractedTrainNumber)) {
                // Handle buttons with span elements
                const span = btn.querySelector('span');
                if (span) {
                    span.textContent = '⭐';
                } else {
                    btn.innerHTML = '⭐';
                }
                btn.classList.add('favorited');
                btn.title = 'Remove from favorites';
            } else if (extractedTrainNumber) {
                // Handle buttons with span elements
                const span = btn.querySelector('span');
                if (span) {
                    span.textContent = '☆';
                } else {
                    btn.innerHTML = '☆';
                }
                btn.classList.remove('favorited');
                btn.title = 'Add to favorites';
            }
        });
    }

    // Helper function to get scheduled time for next station
    getScheduledTimeForNextStation(liveTrainData) {
        try {
            const trainNumber = liveTrainData.TrainNumber || liveTrainData.trainNumber;
            if (!trainNumber || !this.scheduleData || !Array.isArray(this.scheduleData)) {
                console.log('🔍 Missing data:', { 
                    trainNumber, 
                    hasScheduleData: !!this.scheduleData,
                    scheduleDataLength: this.scheduleData ? this.scheduleData.length : 0
                });
                return 'Loading...';
            }

            // Find the corresponding scheduled train - try multiple matching approaches
            let scheduledTrain = this.scheduleData.find(train => 
                String(train.trainNumber) === String(trainNumber)
            );

            // If not found by trainNumber, try TrainNumber field
            if (!scheduledTrain) {
                scheduledTrain = this.scheduleData.find(train => 
                    String(train.TrainNumber) === String(trainNumber)
                );
            }

            // If still not found, try trainId
            if (!scheduledTrain) {
                const trainId = liveTrainData.TrainId || liveTrainData.trainId;
                scheduledTrain = this.scheduleData.find(train => 
                    String(train.trainId) === String(trainId)
                );
            }

            if (!scheduledTrain || !scheduledTrain.stations || scheduledTrain.stations.length === 0) {
                console.log('🔍 No scheduled train found for:', { trainNumber, trainId: liveTrainData.TrainId });
                return 'Schedule N/A';
            }

            // Get current/next station from live data
            const nextStation = liveTrainData.NextStation || liveTrainData.nextStation || '';
            
            // Try to find matching station in schedule
            let matchingStation = null;

            if (nextStation) {
                // First try exact match with NextStation
                matchingStation = scheduledTrain.stations.find(station => 
                    station.StationName && nextStation && 
                    station.StationName.toLowerCase().includes(nextStation.toLowerCase())
                );

                // If not found, try reverse match (nextStation contains stationName)
                if (!matchingStation) {
                    matchingStation = scheduledTrain.stations.find(station => 
                        station.StationName && nextStation && 
                        nextStation.toLowerCase().includes(station.StationName.toLowerCase())
                    );
                }
            }

            // If we found a matching station, use its scheduled time
            if (matchingStation) {
                const scheduledTime = matchingStation.ArrivalTime || matchingStation.DepartureTime;
                if (scheduledTime) {
                    return `📅 ${scheduledTime}`;
                }
            }

            // Fallback: use the first station with a scheduled time
            const stationWithTime = scheduledTrain.stations.find(station => 
                station.ArrivalTime || station.DepartureTime
            );

            if (stationWithTime) {
                const scheduledTime = stationWithTime.DepartureTime || stationWithTime.ArrivalTime;
                return `📅 ${scheduledTime}`;
            }

            return 'Schedule N/A';
        } catch (error) {
            console.error('❌ Error getting scheduled time:', error);
            return 'Schedule N/A';
        }
    }

    // Get full station schedule info including day indicator
    getScheduledStationInfo(liveTrainData) {
        try {
            const trainNumber = liveTrainData.TrainNumber || liveTrainData.trainNumber;
            if (!trainNumber || !this.scheduleData || !Array.isArray(this.scheduleData)) {
                return null;
            }

            // Find the corresponding scheduled train
            let scheduledTrain = this.scheduleData.find(train => 
                String(train.trainNumber) === String(trainNumber) ||
                String(train.TrainNumber) === String(trainNumber)
            );

            if (!scheduledTrain) {
                const trainId = liveTrainData.TrainId || liveTrainData.trainId;
                scheduledTrain = this.scheduleData.find(train => 
                    String(train.trainId) === String(trainId)
                );
            }

            if (!scheduledTrain || !scheduledTrain.stations || scheduledTrain.stations.length === 0) {
                return null;
            }

            // Get current/next station from live data
            const nextStation = liveTrainData.NextStation || liveTrainData.nextStation || '';
            
            if (!nextStation) return null;

            // Try to find matching station in schedule
            let matchingStation = scheduledTrain.stations.find(station => 
                station.StationName && nextStation && 
                station.StationName.toLowerCase().includes(nextStation.toLowerCase())
            );

            if (!matchingStation) {
                matchingStation = scheduledTrain.stations.find(station => 
                    station.StationName && nextStation && 
                    nextStation.toLowerCase().includes(station.StationName.toLowerCase())
                );
            }

            if (matchingStation) {
                return {
                    stationName: matchingStation.StationName,
                    arrivalTime: matchingStation.ArrivalTime || matchingStation.DepartureTime,
                    departureTime: matchingStation.DepartureTime,
                    dayCount: matchingStation.DayCount || 1,
                    isDayChanged: matchingStation.IsDayChanged || false
                };
            }

            return null;
        } catch (error) {
            console.error('❌ Error getting scheduled station info:', error);
            return null;
        }
    }

    updateDarkModeIcon(isDarkMode) {
        const icon = document.getElementById('darkModeIcon');
        if (icon) {
            icon.textContent = isDarkMode ? '☀️' : '🌙';
        }
    }

    // Enhanced Mobile Navigation and Features (merged with main goBack function above)

    // This function was duplicate and removed - using the main navigateToScreen above

    updateNavigation(activeScreenId) {
        // Remove active from all nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Map screen IDs to nav data attributes
        const screenToNav = {
            'home': 'home',
            'dashboard': 'home',
            'liveTracking': 'track',
            'trainSearchScreen': 'search',
            'favoritesScreen': 'favorites',
            'profileScreen': 'profile',
            'scheduleScreen': 'track',
            'stationScreen': 'search'
        };
        
        const navId = screenToNav[activeScreenId];
        if (navId) {
            const navItem = document.querySelector(`[data-nav="${navId}"]`);
            if (navItem) {
                navItem.classList.add('active');
            }
        }
    }

    loadScreenData(screenId) {
        console.log('📊 Loading data for screen:', screenId);
        
        try {
            switch(screenId) {
                case 'home':
                case 'dashboard':
                    this.loadDashboardData();
                    break;
                case 'liveTracking':
                    this.loadLiveTrains();
                    // Ensure the screen is populated after loading data
                    setTimeout(() => {
                        this.populateLiveTrackingScreen();
                        this.initializeLiveTrackingSearch();
                    }, 100);
                    break;
                case 'scheduleScreen':
                    this.loadSchedule();
                    break;
                case 'stationScreen':
                    this.loadStations();
                    break;
                case 'trainSearchScreen':
                    // Search screen loads on demand
                    console.log('🔍 Train search screen ready');
                    break;
                case 'favoritesScreen':
                    console.log('📊 Calling loadFavorites() from loadScreenData');
                    try {
                        this.loadFavorites();
                    } catch (error) {
                        console.error('❌ Error in loadFavorites:', error);
                    }
                    break;
                case 'profileScreen':
                    this.loadProfile();
                    break;
                case 'mapScreen':
                    this.initializeMap();
                    this.initializeMapSearch();
                    break;
                default:
                    console.log('ℹ️ No specific data loading for screen:', screenId);
            }
        } catch (error) {
            console.error(`❌ Error loading data for ${screenId}:`, error);
            this.showError(`Failed to load ${screenId} data`);
        }
    }

    loadDashboardData() {
        this.updateDashboardStats();
        this.loadRecentTrains();
        this.setupQuickActions();
    }

    updateDashboardStats() {
        console.log('📊 Updating dashboard stats...');
        
        if (this.trainData && this.trainData.active) {
            const totalTrains = this.trainData.active.length;
            const onTimeTrains = this.trainData.active.filter(t => (t.LateBy || 0) <= 5).length;
            const delayedTrains = totalTrains - onTimeTrains;
            
            // Estimate stations (this would come from API in real scenario)
            const estimatedStations = 150;
            
            const activeEl = document.getElementById('dashboardActiveTrains');
            const onTimeEl = document.getElementById('dashboardOnTime'); 
            const delayedEl = document.getElementById('dashboardDelayed');
            const stationsEl = document.getElementById('dashboardStations');
            
            if (activeEl) activeEl.textContent = totalTrains;
            if (onTimeEl) onTimeEl.textContent = onTimeTrains;
            if (delayedEl) delayedEl.textContent = delayedTrains;
            if (stationsEl) stationsEl.textContent = estimatedStations;
            
            console.log('📊 Dashboard stats updated:', { totalTrains, onTimeTrains, delayedTrains, estimatedStations });
        } else {
            console.log('⚠️ No train data available for dashboard stats');
        }
    }

    loadRecentTrains() {
        const recentContainer = document.getElementById('dashboardRecentTrains');
        if (!recentContainer || !this.trainData?.active) {
            console.log('⚠️ Recent trains container or data not found');
            return;
        }
        
        const recentTrains = [...this.trainData.active]
            .sort((a, b) => new Date(b.LastUpdate || 0) - new Date(a.LastUpdate || 0))
            .slice(0, 5);
        
        let html = '';
        recentTrains.forEach(train => {
            const delay = train.LateBy || 0;
            const statusClass = delay <= 5 ? 'on-time' : 'delayed';
            const statusText = delay <= 5 ? 'On Time' : this.formatDelayDisplay(delay);
            
            html += `
                <div class="recent-train-item" onclick="mobileApp.openTrainDetails('${train.InnerKey}')">
                    <div class="train-info">
                        <div class="train-name">${train.TrainName || 'Unknown Train'}</div>
                        <div class="train-number">${train.TrainNumber || train.InnerKey}</div>
                    </div>
                    <div class="train-status ${statusClass}">
                        <div class="status-text">${statusText}</div>
                        <div class="next-station">${train.NextStation || 'N/A'}</div>
                    </div>
                </div>
            `;
        });
        
        recentContainer.innerHTML = html;
    }

    setupQuickActions() {
        const searchBtn = document.getElementById('quickSearchBtn');
        const favoritesBtn = document.getElementById('quickFavoritesBtn');
        const mapBtn = document.getElementById('quickMapBtn');
        const settingsBtn = document.getElementById('quickSettingsBtn');
        
        if (searchBtn) searchBtn.onclick = () => this.navigateToScreen('stationScreen');
        if (favoritesBtn) favoritesBtn.onclick = () => this.navigateToScreen('favoritesScreen');
        if (mapBtn) mapBtn.onclick = () => this.navigateToScreen('mapScreen');
        if (settingsBtn) settingsBtn.onclick = () => this.showSettings();
    }

    loadSchedules() {
        const schedulesContainer = document.getElementById('schedulesContainer');
        if (schedulesContainer) {
            schedulesContainer.innerHTML = '<div class="loading">Loading train schedules...</div>';
            this.loadPopularRoutes();
        }
    }

    loadPopularRoutes() {
        const routesContainer = document.getElementById('popularRoutes');
        if (!routesContainer) return;
        
        const popularRoutes = [
            { from: 'Karachi Cantt', to: 'Lahore Junction', trains: 12 },
            { from: 'Lahore Junction', to: 'Rawalpindi', trains: 8 },
            { from: 'Karachi Cantt', to: 'Rawalpindi', trains: 6 },
            { from: 'Multan Cantt', to: 'Karachi Cantt', trains: 10 },
            { from: 'Faisalabad', to: 'Lahore Junction', trains: 15 }
        ];
        
        let html = '';
        popularRoutes.forEach(route => {
            html += `
                <div class="route-card" onclick="mobileApp.searchRoute('${route.from}', '${route.to}')">
                    <div class="route-info">
                        <div class="route-stations">
                            <span class="from-station">${route.from}</span>
                            <span class="route-arrow">→</span>
                            <span class="to-station">${route.to}</span>
                        </div>
                        <div class="train-count">${route.trains} trains daily</div>
                    </div>
                </div>
            `;
        });
        
        routesContainer.innerHTML = html;
    }

    async loadStations() {
        console.log('🚉 Loading all stations...');
        
        // Ensure we have schedule and live train data
        if (!this.scheduleData || this.scheduleData.length === 0) {
            await this.loadScheduledTrainsForHome();
        }
        if (!this.trainData.active || this.trainData.active.length === 0) {
            await this.loadLiveTrains();
        }
        
        // Extract all unique stations from schedule data
        const allStations = this.extractAllStationsFromSchedule();
        
        // Store for search functionality
        this.allStationsData = allStations;
        
        // Populate stations list
        this.populateStationsList(allStations);
        
        // Initialize search
        this.initializeStationSearch();
    }

    extractAllStationsFromSchedule() {
        console.log('📊 Extracting stations from schedule data...');
        const stationsMap = new Map();
        
        if (!this.scheduleData) return [];
        
        // Go through each train's schedule and collect all stations
        this.scheduleData.forEach(train => {
            if (train.stations && Array.isArray(train.stations)) {
                train.stations.forEach(station => {
                    const stationName = station.StationName || station.stationName;
                    if (stationName && !stationsMap.has(stationName)) {
                        stationsMap.set(stationName, {
                            name: stationName,
                            trainCount: 0,
                            upcomingTrains: []
                        });
                    }
                });
            }
        });
        
        const stations = Array.from(stationsMap.values());
        console.log(`✅ Found ${stations.length} unique stations`);
        
        // Sort stations alphabetically
        stations.sort((a, b) => a.name.localeCompare(b.name));
        
        return stations;
    }

    populateStationsList(stations) {
        const container = document.getElementById('stationsList');
        if (!container) return;
        
        if (!stations || stations.length === 0) {
            container.innerHTML = '<div class="empty-state">No stations data available</div>';
            return;
        }
        
        console.log(`🚉 Populating ${stations.length} stations with train data...`);
        console.log(`📊 Active trains available: ${this.trainData.active?.length || 0}`);
        
        // Debug: Show sample of train NextStation values
        if (this.trainData.active && this.trainData.active.length > 0) {
            console.log('🔍 Sample train NextStation values:', 
                this.trainData.active.slice(0, 5).map(t => ({
                    train: t.TrainName,
                    nextStation: t.NextStation,
                    currentStation: t.CurrentStation
                }))
            );
        }
        
        let html = '';
        let totalUpTrains = 0;
        let totalDownTrains = 0;
        
        stations.forEach(station => {
            // Find all upcoming trains for this station (both UP and DOWN)
            const upcomingTrains = this.findUpcomingTrainsForStation(station.name);
            
            totalUpTrains += upcomingTrains.up.length;
            totalDownTrains += upcomingTrains.down.length;
            
            html += `
                <div class="station-card-expandable">
                    <div class="station-header" onclick="mobileApp.toggleStationTrains('${station.name.replace(/'/g, "\\'")}')">
                    <div class="station-info">
                            <div class="station-name">🚉 ${station.name}</div>
                    <div class="station-meta">
                                ${upcomingTrains.up.length} UP • ${upcomingTrains.down.length} DN
                            </div>
                        </div>
                        <div class="expand-icon" id="expand-${this.sanitizeId(station.name)}">▼</div>
                    </div>
                    <div class="station-trains-list" id="trains-${this.sanitizeId(station.name)}" style="display: none;">
                        ${this.generateStationTrainsHTML(upcomingTrains)}
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        console.log(`✅ Found total: ${totalUpTrains} UP trains, ${totalDownTrains} DN trains across all stations`);
        
        // Update results count
        const resultsCount = document.getElementById('stationsResultsCount');
        if (resultsCount) {
            resultsCount.textContent = `${stations.length} stations`;
        }
    }

    findUpcomingTrainsForStation(stationName) {
        const upTrains = [];
        const downTrains = [];
        
        if (!this.trainData.active || !this.scheduleData) {
            return { up: upTrains, down: downTrains };
        }
        
        // Normalize station name for better matching
        const normalizedStationName = this.normalizeStationName(stationName);
        
        this.trainData.active.forEach(liveTrain => {
            // Get the schedule for this train
            const schedule = this.scheduleData.find(s => 
                String(s.trainNumber) === String(liveTrain.TrainNumber)
            );
            
            if (!schedule || !schedule.stations) return;
            
            // Find if this station exists in the train's route
            const stationIndex = schedule.stations.findIndex(station => {
                const scheduleStationName = this.normalizeStationName(station.StationName);
                return scheduleStationName === normalizedStationName || 
                       scheduleStationName.includes(normalizedStationName) ||
                       normalizedStationName.includes(scheduleStationName);
            });
            
            if (stationIndex === -1) return; // Station not in this train's route
            
            // Get the station details from schedule
            const stationInRoute = schedule.stations[stationIndex];
            
            // Find current position of train in its route
            const currentStationIndex = schedule.stations.findIndex(station => {
                const scheduleStationName = this.normalizeStationName(station.StationName);
                const nextStationName = this.normalizeStationName(liveTrain.NextStation || '');
                return scheduleStationName === nextStationName || 
                       scheduleStationName.includes(nextStationName);
            });
            
            // Only show trains that haven't passed this station yet
            // (current station index should be before or at this station)
            if (currentStationIndex !== -1 && currentStationIndex > stationIndex) {
                return; // Train has already passed this station
            }
            
            // Calculate ETA for this specific station
            let stationETA = stationInRoute.ArrivalTime || stationInRoute.DepartureTime || '--:--';
            
            // If this is the next station, use live ETA
            if (currentStationIndex === stationIndex) {
                stationETA = liveTrain.NextStationETA || stationETA;
            }
            
            const trainInfo = {
                trainNumber: liveTrain.TrainNumber,
                trainName: liveTrain.TrainName,
                innerKey: liveTrain.InnerKey,
                nextStation: liveTrain.NextStation,
                stationName: stationInRoute.StationName, // Actual station name from route
                eta: stationETA,
                arrivalTime: stationInRoute.ArrivalTime,
                departureTime: stationInRoute.DepartureTime,
                speed: liveTrain.Speed || 0,
                delay: this.calculateDelayFromETA(liveTrain) || 0,
                trainDate: this.getTrainDate(liveTrain.LastUpdated, liveTrain.InnerKey, liveTrain.TrainNumber),
                isNextStation: currentStationIndex === stationIndex
            };
            
            // Determine direction
            const trainName = liveTrain.TrainName || '';
            if (trainName.toUpperCase().includes('DN') || trainName.toUpperCase().includes('DOWN')) {
                downTrains.push(trainInfo);
            } else {
                upTrains.push(trainInfo);
            }
        });
        
        // Sort by ETA (closest first)
        const sortByETA = (a, b) => {
            if (!a.eta || a.eta === '--:--') return 1;
            if (!b.eta || b.eta === '--:--') return -1;
            
            const timeA = this.parseTimeToMinutes(a.eta);
            const timeB = this.parseTimeToMinutes(b.eta);
            
            return timeA - timeB;
        };
        
        upTrains.sort(sortByETA);
        downTrains.sort(sortByETA);
        
        return { up: upTrains, down: downTrains };
    }

    normalizeStationName(name) {
        if (!name) return '';
        
        return name
            .toLowerCase()
            .trim()
            // Remove common suffixes
            .replace(/\s+(jn|junc|junction|cantt|cant|station|stn)$/i, '')
            // Remove extra spaces
            .replace(/\s+/g, ' ')
            .trim();
    }

    generateStationTrainsHTML(upcomingTrains) {
        let html = '';
        
        if (upcomingTrains.up.length === 0 && upcomingTrains.down.length === 0) {
            return '<div class="empty-state-small">No upcoming trains at this station</div>';
        }
        
        // UP Trains Section
        if (upcomingTrains.up.length > 0) {
            html += '<div class="direction-section"><div class="direction-header">⬆️ UP Trains</div>';
            upcomingTrains.up.forEach(train => {
                html += this.generateStationTrainCard(train);
            });
            html += '</div>';
        }
        
        // DOWN Trains Section
        if (upcomingTrains.down.length > 0) {
            html += '<div class="direction-section"><div class="direction-header">⬇️ DOWN Trains</div>';
            upcomingTrains.down.forEach(train => {
                html += this.generateStationTrainCard(train);
            });
            html += '</div>';
        }
        
        return html;
    }

    generateStationTrainCard(train) {
        const delayClass = train.delay > 15 ? 'delayed' : (train.delay > 0 ? 'slightly-delayed' : 'on-time');
        const delayText = train.delay > 0 ? `${this.formatDelayDisplay(train.delay)}` : 'On Time';
        const statusClass = train.speed > 0 ? 'status-moving' : 'status-stopped';
        const headerClass = train.delay > 0 ? 'header-delayed' : 'header-ontime';
        
        return `
            <div class="train-card station-train-item" onclick="mobileApp.openTrainDetails('${train.innerKey}')">
                <div class="train-card-header ${headerClass}">
                    <div class="train-header-content">
                        <div class="train-name">${train.trainName}</div>
                    </div>
                </div>
                <div class="train-route">
                    <div class="train-number">#${train.trainNumber}</div>
                    <div class="train-route-arrow">→</div>
                    <div class="next-station">${train.stationName}</div>
                </div>
                <div class="train-info-grid">
                    ${train.isNextStation ? `
                    <div class="info-row">
                        <span class="info-icon">🔴</span>
                        <span class="info-text">LIVE - Arriving Next</span>
                    </div>
                    ` : ''}
                    <div class="info-row">
                        <span class="info-icon">🕐</span>
                        <span class="info-text">ETA: ${train.eta || '--:--'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-icon">📍</span>
                        <span class="info-text">Arriving at: ${train.stationName}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-icon">⏱️</span>
                        <span class="info-text">Delay: ${delayText}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-icon">⚡</span>
                        <span class="info-text">Speed: ${train.speed} km/h</span>
                    </div>
                    <div class="info-row">
                        <span class="info-icon">📅</span>
                        <span class="info-text">Train Date: ${train.trainDate}</span>
                    </div>
                </div>
                <div class="train-status-row">
                    <div class="status-badge ${statusClass}">
                        ${train.speed > 0 ? 'Moving' : 'Stopped'}
                    </div>
                </div>
            </div>
        `;
    }

    toggleStationTrains(stationName) {
        const sanitizedId = this.sanitizeId(stationName);
        const trainsList = document.getElementById(`trains-${sanitizedId}`);
        const expandIcon = document.getElementById(`expand-${sanitizedId}`);
        
        if (trainsList && expandIcon) {
            if (trainsList.style.display === 'none') {
                trainsList.style.display = 'block';
                expandIcon.textContent = '▲';
            } else {
                trainsList.style.display = 'none';
                expandIcon.textContent = '▼';
            }
        }
    }

    sanitizeId(str) {
        return str.replace(/[^a-zA-Z0-9]/g, '-');
    }

    initializeStationSearch() {
        const searchInput = document.getElementById('stationSearchInput');
        const clearBtn = document.getElementById('clearStationSearch');
        
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.trim();
                this.filterStationsBySearch(query);
                
                if (clearBtn) {
                    clearBtn.style.display = query ? 'flex' : 'none';
                }
            });
        }
    }

    filterStationsBySearch(query) {
        if (!this.allStationsData) return;
        
        const searchResults = document.getElementById('stationSearchResults');
        
        if (!query) {
            this.populateStationsList(this.allStationsData);
            if (searchResults) searchResults.style.display = 'none';
            return;
        }
        
        const lowerQuery = query.toLowerCase();
        const filtered = this.allStationsData.filter(station =>
            station.name.toLowerCase().includes(lowerQuery)
        );
        
        this.populateStationsList(filtered);
        
        if (searchResults) {
            searchResults.textContent = `Found ${filtered.length} stations matching your search`;
            searchResults.style.display = 'block';
        }
    }

    clearStationSearch() {
        const searchInput = document.getElementById('stationSearchInput');
        const clearBtn = document.getElementById('clearStationSearch');
        const searchResults = document.getElementById('stationSearchResults');
        
        if (searchInput) searchInput.value = '';
        if (clearBtn) clearBtn.style.display = 'none';
        if (searchResults) searchResults.style.display = 'none';
        
        if (this.allStationsData) {
            this.populateStationsList(this.allStationsData);
        }
    }

    // loadFavorites function is defined earlier in the class (line ~2154)
    // This duplicate has been removed to avoid conflicts

    getFavoriteTrains() {
        const favorites = localStorage.getItem('favoriteTrains');
        return favorites ? JSON.parse(favorites) : [];
    }

    // toggleFavorite function is defined earlier in the class (line ~3365)
    // This duplicate has been removed to avoid conflicts

    showToast(message, duration = 3000) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.parentNode?.removeChild(toast), 300);
        }, duration);
    }

    searchRoute(from, to) {
        this.showToast(`Searching trains from ${from} to ${to}`);
    }

    openStationDetails(code) {
        this.showToast(`Loading ${code} station details`);
    }

    showSettings() {
        this.showToast('Settings feature coming soon!');
    }

    // Missing utility functions
    showError(message) {
        this.showToast(`Error: ${message}`, 5000);
    }

    showSuccess(message) {
        this.showToast(`✅ ${message}`, 3000);
    }

    showLoading(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = '<div class="loading">Loading...</div>';
        }
    }

    hideLoading(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            const loading = container.querySelector('.loading');
            if (loading) loading.remove();
        }
    }

    // Missing navigation helpers
    getCurrentScreen() {
        const activeScreen = document.querySelector('.screen.active, .screen:not(.hidden)');
        return activeScreen ? activeScreen.id : 'home';
    }

    // Screen management functions moved to main navigateToScreen above

    // Enhanced error handling
    handleApiError(error, context = 'API call') {
        console.error(`${context} failed:`, error);
        this.showError(`${context} failed. Please try again.`);
    }

    // Refresh current screen
    refreshCurrentScreen() {
        const currentScreen = this.getCurrentScreen();
        if (currentScreen && currentScreen !== 'home') {
            this.loadScreenData(currentScreen);
        } else {
            this.loadLiveTrains();
            this.loadLiveUpdates();
        }
    }

    // Check if train is out of coverage
    isTrainOutOfCoverage(train) {
        // Check for missing critical data
        const hasTrainNumber = train.TrainNumber && train.TrainNumber !== 'undefined';
        const hasLocation = train.CurrentStation || train.NextStation || train.LastStation;
        const hasCoordinates = train.Latitude && train.Longitude;
        const hasRecentUpdate = train.LastUpdated && new Date(train.LastUpdated) > new Date(Date.now() - 30 * 60 * 1000); // 30 minutes
        
        // Check if train has been updated recently (within 30 minutes)
        const isRecentlyUpdated = hasRecentUpdate;
        
        // Train is out of coverage if:
        // 1. No train number
        // 2. No location data
        // 3. No coordinates
        // 4. No recent updates
        const isOutOfCoverage = !hasTrainNumber || !hasLocation || !hasCoordinates || !isRecentlyUpdated;
        
        if (isOutOfCoverage) {
            console.log('🚫 Train out of coverage:', {
                trainNumber: train.TrainNumber,
                hasLocation: !!hasLocation,
                hasCoordinates: !!hasCoordinates,
                isRecentlyUpdated: isRecentlyUpdated,
                lastUpdated: train.LastUpdated
            });
        }
        
        return isOutOfCoverage;
    }

    // Map functionality methods
    initializeMap() {
        console.log('🗺️ Initializing map...');
        
        // Reset selected train when opening map screen
        console.log('🔄 Resetting selected train and panels');
        this.selectedTrain = null;
        this.hideTrainInfoPanel();
        this.stopMapAutoRefresh();
        
        if (this.map) {
            console.log('🗺️ Map already initialized, reloading trains');
            // Map already exists, just reload trains and show selection panel
            this.loadMapTrains();
            this.showTrainSelectionPanel();
            return;
        }

        try {
            // Initialize Leaflet map
            this.map = L.map('liveMap').setView([30.3753, 69.3451], 7);
            
            // Add OpenStreetMap tiles
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(this.map);
            
            console.log('🗺️ Map initialized successfully');
            
            // Load active trains and show train selection panel
            this.loadMapTrains();
            this.showTrainSelectionPanel();
            
        } catch (error) {
            console.error('❌ Error initializing map:', error);
            this.showError('Failed to initialize map');
        }
    }

    async loadMapTrains() {
        try {
            console.log('🚂 Loading trains for map...');
            const response = await fetch(getAPIUrl('live'));
            const data = await response.json();
            
            if (data.success && data.data) {
                console.log(`📊 Raw train data: ${data.data.length} trains`);
                
                // Apply the same filtering logic as other screens
                let filteredTrains = data.data;
                
                // 1. Filter by recent dates (last 3 days)
                filteredTrains = this.filterByRecentDates(filteredTrains, 3);
                console.log(`📅 After date filter: ${filteredTrains.length} trains`);
                
                // 2. Filter duplicate trains (keep first 2 instances per train number + direction, latest 2 dates)
                filteredTrains = this.filterDuplicateTrains(filteredTrains);
                console.log(`🔄 After duplicate filter: ${filteredTrains.length} trains`);
                
                // 3. Filter completed journeys (reached destination, stopped, 30+ min old)
                filteredTrains = this.filterCompletedJourneys(filteredTrains);
                console.log(`🏁 After completed journeys filter: ${filteredTrains.length} trains`);
                
                // 4. Filter unrealistic delays (24+ hours)
                filteredTrains = this.filterUnrealisticDelays(filteredTrains);
                console.log(`⏰ After unrealistic delays filter: ${filteredTrains.length} trains`);
                
                this.trainData.active = filteredTrains;
                this.populateTrainSelection();
                this.updateMapWithTrains(filteredTrains);
            } else {
                console.error('❌ Failed to load train data for map');
                this.showError('Failed to load train data');
            }
        } catch (error) {
            console.error('❌ Error loading map trains:', error);
            this.showError('Failed to load train data');
        }
    }

    populateTrainSelection() {
        const trainList = document.getElementById('trainList');
        if (!trainList) return;

        if (!this.trainData.active || this.trainData.active.length === 0) {
            trainList.innerHTML = '<div class="loading">No active trains found</div>';
            return;
        }

        let html = '';
        this.trainData.active.forEach(train => {
            const trainNumber = train.TrainNumber || train.InnerKey || 'Unknown';
            const trainName = train.TrainName || `Train ${trainNumber}`;
            const speed = train.Speed || 0;
            const currentLocation = train.CurrentStation || train.NextStation || train.LastStation || 'Unknown';
            const nextStation = train.NextStation || 'Unknown';
            const eta = train.NextStationETA || '--:--';
            // Improved direction detection logic
            const trainNameUp = String(trainName).toUpperCase();
            const trainNumberUp = String(trainNumber).toUpperCase();
            let direction = train.Direction || 'Unknown';
            
            if (direction === 'Unknown') {
                // Check both train name and train number for UP/DOWN indicators
                if (trainNameUp.includes('UP') || trainNumberUp.includes('UP')) {
                    direction = 'UP';
                } else if (trainNameUp.includes('DOWN') || trainNameUp.includes('DN') || 
                           trainNumberUp.includes('DOWN') || trainNumberUp.includes('DN')) {
                    direction = 'DOWN';
                } else {
                    // Fallback to train number parity only if no text indicators
                    const numericPart = parseInt(String(trainNumber).replace(/\D/g, ''));
                    if (!isNaN(numericPart)) {
                        direction = (numericPart % 2 === 0) ? 'UP' : 'DOWN';
                    }
                }
            }
            
            html += `
                <div class="train-item" onclick="mobileApp.selectTrain('${train.InnerKey || train.TrainId}')">
                    <div class="train-info">
                        <div class="train-number">${trainNumber}</div>
                        <div class="train-name">${trainName}</div>
                        <div class="train-direction">${direction}</div>
                    </div>
                    <div class="train-status">
                        <div class="train-speed">${speed} km/h</div>
                        <div class="train-location">${currentLocation}</div>
                        <div class="train-next">Next: ${nextStation}</div>
                        <div class="train-eta">ETA: ${eta}</div>
                    </div>
                </div>
            `;
        });

        trainList.innerHTML = html;
    }

    initializeMapSearch() {
        const searchInput = document.getElementById('mapSearchInput');
        const clearBtn = document.getElementById('clearMapSearch');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.trim();
                
                // Show/hide clear button
                if (clearBtn) {
                    clearBtn.style.display = query ? 'flex' : 'none';
                }

                // Filter trains
                this.filterMapTrains(query);
            });
        }
    }

    filterMapTrains(query) {
        if (!query) {
            // Show all trains if search is empty
            this.populateTrainSelection();
            // Update map to show all trains
            this.updateMapWithTrains(this.trainData.active);
            return;
        }

        const searchQuery = query.toLowerCase();
        const trainList = document.getElementById('trainList');
        
        if (!trainList) return;

        const filteredTrains = this.trainData.active.filter(train => {
            const trainNumber = String(train.TrainNumber || '').toLowerCase();
            const trainName = String(train.TrainName || '').toLowerCase();
            const innerKey = String(train.InnerKey || '').toLowerCase();
            const currentStation = String(train.CurrentStation || '').toLowerCase();
            const nextStation = String(train.NextStation || '').toLowerCase();

            return trainNumber.includes(searchQuery) ||
                   trainName.includes(searchQuery) ||
                   innerKey.includes(searchQuery) ||
                   currentStation.includes(searchQuery) ||
                   nextStation.includes(searchQuery);
        });

        // Update the map to show only filtered trains
        this.updateMapWithTrains(filteredTrains);

        // Update the display with filtered results
        if (filteredTrains.length === 0) {
            trainList.innerHTML = '<div class="no-results">No trains match your search</div>';
            return;
        }

        let html = '';
        filteredTrains.forEach(train => {
            const trainNumber = train.TrainNumber || train.InnerKey || 'Unknown';
            const trainName = train.TrainName || `Train ${trainNumber}`;
            const speed = train.Speed || 0;
            const currentLocation = train.CurrentStation || train.NextStation || train.LastStation || 'Unknown';
            const nextStation = train.NextStation || 'Unknown';
            const eta = train.NextStationETA || '--:--';
            
            // Improved direction detection logic
            const trainNameUp = String(trainName).toUpperCase();
            const trainNumberUp = String(trainNumber).toUpperCase();
            let direction = train.Direction || 'Unknown';
            
            if (direction === 'Unknown') {
                if (trainNameUp.includes('UP') || trainNumberUp.includes('UP')) {
                    direction = 'UP';
                } else if (trainNameUp.includes('DOWN') || trainNameUp.includes('DN') || 
                           trainNumberUp.includes('DOWN') || trainNumberUp.includes('DN')) {
                    direction = 'DOWN';
                } else {
                    const numericPart = parseInt(String(trainNumber).replace(/\D/g, ''));
                    if (!isNaN(numericPart)) {
                        direction = (numericPart % 2 === 0) ? 'UP' : 'DOWN';
                    }
                }
            }
            
            html += `
                <div class="train-item" onclick="mobileApp.selectTrain('${train.InnerKey || train.TrainId}')">
                    <div class="train-info">
                        <div class="train-number">${trainNumber}</div>
                        <div class="train-name">${trainName}</div>
                        <div class="train-direction">${direction}</div>
                    </div>
                    <div class="train-status">
                        <div class="train-speed">${speed} km/h</div>
                        <div class="train-location">${currentLocation}</div>
                        <div class="train-next">Next: ${nextStation}</div>
                        <div class="train-eta">ETA: ${eta}</div>
                    </div>
                </div>
            `;
        });

        trainList.innerHTML = html;
    }

    clearMapSearch() {
        const searchInput = document.getElementById('mapSearchInput');
        const clearBtn = document.getElementById('clearMapSearch');

        if (searchInput) {
            searchInput.value = '';
            if (clearBtn) {
                clearBtn.style.display = 'none';
            }
            this.populateTrainSelection(); // Show all trains in list
            this.updateMapWithTrains(this.trainData.active); // Show all trains on map
        }
    }

    selectTrain(trainId) {
        console.log('🚂 Selecting train:', trainId);
        
        const train = this.trainData.active.find(t => 
            t.InnerKey === trainId || t.TrainId === trainId || t.TrainNumber === trainId
        );
        
        if (!train) {
            console.error('❌ Train not found:', trainId);
            return;
        }

        this.selectedTrain = train;
        this.hideTrainSelectionPanel();
        this.showTrainInfoPanel();
        this.updateMapWithSelectedTrain(train);
        this.startMapAutoRefresh();
    }

    updateMapWithTrains(trains) {
        if (!this.map) return;

        // Clear existing markers
        this.clearMapMarkers();

        trains.forEach(train => {
            if (train.Latitude && train.Longitude) {
                this.addTrainMarker(train);
            }
        });
    }

    updateMapWithSelectedTrain(train) {
        if (!this.map) return;

        // Clear existing markers
        this.clearMapMarkers();

        // Add selected train marker
        if (train.Latitude && train.Longitude) {
            this.addTrainMarker(train, true);
            this.map.setView([train.Latitude, train.Longitude], 12);
        }

        // Load and display route if available
        this.loadTrainRoute(train);
    }

    addTrainMarker(train, isSelected = false) {
        if (!this.map) return;

        const trainNumber = train.TrainNumber || train.InnerKey || 'Unknown';
        const trainName = train.TrainName || `Train ${trainNumber}`;
        const speed = train.Speed || 0;
        const status = speed > 0 ? 'Moving' : 'Stopped';
        
        // Create train icon
        const trainIcon = L.divIcon({
            html: `
                <div style="
                    background: ${isSelected ? '#3b82f6' : '#059669'};
                    color: white;
                    border-radius: 50%;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 16px;
                    font-weight: bold;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    border: 2px solid white;
                ">
                    🚂
                </div>
            `,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
            popupAnchor: [0, -15],
            className: 'train-marker'
        });

        const marker = L.marker([train.Latitude, train.Longitude], {
            icon: trainIcon
        }).addTo(this.map);

        // Add popup
        const currentLocation = train.CurrentStation || train.NextStation || train.LastStation || 'Unknown';
        const nextStation = train.NextStation || 'Unknown';
        const eta = train.NextStationETA || '--:--';
        
        // Check if train has reached the station (within 2 minutes of ETA)
        let hasReachedStation = false;
        if (eta && eta !== '--:--') {
            const etaMinutes = this.parseTimeToMinutes(eta);
            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            
            if (etaMinutes !== null) {
                let minutesUntilArrival = etaMinutes - currentMinutes;
                if (minutesUntilArrival < 0) minutesUntilArrival += 1440; // Handle day boundary
                
                // Train has reached if within 2 minutes or passed
                if (minutesUntilArrival <= 2) {
                    hasReachedStation = true;
                }
            }
        }
        
        // Improved direction detection logic
        const trainNameUp = String(trainName).toUpperCase();
        const trainNumberUp = String(trainNumber).toUpperCase();
        let direction = train.Direction || 'Unknown';
        
        if (direction === 'Unknown') {
            // Check both train name and train number for UP/DOWN indicators
            if (trainNameUp.includes('UP') || trainNumberUp.includes('UP')) {
                direction = 'UP';
            } else if (trainNameUp.includes('DOWN') || trainNameUp.includes('DN') || 
                       trainNumberUp.includes('DOWN') || trainNumberUp.includes('DN')) {
                direction = 'DOWN';
            } else {
                // Fallback to train number parity only if no text indicators
                const numericPart = parseInt(String(trainNumber).replace(/\D/g, ''));
                if (!isNaN(numericPart)) {
                    direction = (numericPart % 2 === 0) ? 'UP' : 'DOWN';
                }
            }
        }
        
        // Get the correct train ID for the View Details button
        const trainId = train.InnerKey || train.TrainId || train.TrainNumber;
        
        // Only show "Current:" label if train has reached the station
        const currentLabel = hasReachedStation ? `<p style="margin: 5px 0; font-weight: bold; color: #059669;">Current: ${currentLocation}</p>` : '';
        
        const popupContent = `
            <div style="text-align: center; min-width: 200px;">
                <h3 style="margin: 0 0 10px 0; color: #1f2937;">${trainName}</h3>
                <p style="margin: 5px 0; font-weight: bold; color: #059669;">Train #${trainNumber}</p>
                <p style="margin: 5px 0;">Speed: ${speed} km/h</p>
                <p style="margin: 5px 0;">Status: ${status}</p>
                <p style="margin: 5px 0;">Direction: ${direction}</p>
                ${currentLabel}
                <p style="margin: 5px 0;">Next: ${nextStation}</p>
                <p style="margin: 5px 0;">ETA: ${eta}</p>
                ${isSelected ? `<button onclick="mobileApp.openTrainDetails('${trainId}')" style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin-top: 10px; cursor: pointer;">View Details</button>` : ''}
            </div>
        `;
        
        marker.bindPopup(popupContent);
        
        if (isSelected) {
            marker.openPopup();
        }

        this.trainMarkers.push(marker);
    }

    async loadTrainRoute(train) {
        if (!train.TrainNumber) return;

        try {
            const response = await fetch(`${API_CONFIG.getBaseURL()}/api/train/${train.TrainNumber}`);
            const data = await response.json();
            
            if (data.success && data.data && data.data.schedule) {
                this.displayTrainRoute(data.data.schedule);
            }
        } catch (error) {
            console.error('❌ Error loading train route:', error);
        }
    }

    displayTrainRoute(stations) {
        if (!this.map || !stations || stations.length === 0) return;

        // Clear existing route lines
        this.clearRouteLines();

        const coordinates = [];
        const stationMarkers = [];

        stations.forEach((station, index) => {
            if (station.Latitude && station.Longitude) {
                coordinates.push([station.Latitude, station.Longitude]);
                
                // Add station marker
                const stationMarker = L.circleMarker([station.Latitude, station.Longitude], {
                    radius: 6,
                    fillColor: '#667eea',
                    color: '#fff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.8
                }).addTo(this.map);
                
                stationMarker.bindPopup(`
                    <strong>${station.StationName}</strong><br>
                    Arrival: ${station.ArrivalTime || '--:--'}<br>
                    Departure: ${station.DepartureTime || '--:--'}
                `);
                
                stationMarkers.push(stationMarker);
            }
        });

        // Draw route line
        if (coordinates.length > 1) {
            const routeLine = L.polyline(coordinates, {
                color: '#8B4513',
                weight: 6,
                opacity: 0.8
            }).addTo(this.map);

            // Add track rails
            const trackRails = L.polyline(coordinates, {
                color: '#C0C0C0',
                weight: 2,
                opacity: 1,
                dashArray: '5,2'
            }).addTo(this.map);

            this.routeLines.push(routeLine, trackRails);
        }
    }

    clearMapMarkers() {
        this.trainMarkers.forEach(marker => {
            if (this.map) this.map.removeLayer(marker);
        });
        this.trainMarkers = [];
    }

    clearRouteLines() {
        this.routeLines.forEach(line => {
            if (this.map) this.map.removeLayer(line);
        });
        this.routeLines = [];
    }

    showTrainSelectionPanel() {
        const panel = document.getElementById('trainSelectionPanel');
        if (panel) {
            panel.classList.add('show');
        }
    }

    hideTrainSelectionPanel() {
        const panel = document.getElementById('trainSelectionPanel');
        if (panel) {
            panel.classList.remove('show');
        }
    }

    showTrainInfoPanel() {
        const panel = document.getElementById('trainInfoPanel');
        if (panel && this.selectedTrain) {
            this.updateTrainInfoPanel();
            panel.classList.add('show');
        }
    }

    hideTrainInfoPanel() {
        const panel = document.getElementById('trainInfoPanel');
        if (panel) {
            panel.classList.remove('show');
        }
    }

    updateTrainInfoPanel() {
        if (!this.selectedTrain) return;

        const train = this.selectedTrain;
        const trainNumber = train.TrainNumber || train.InnerKey || 'Unknown';
        const trainName = train.TrainName || `Train ${trainNumber}`;
        const speed = train.Speed || 0;
        const status = speed > 0 ? 'Moving' : 'Stopped';
        const currentLocation = train.CurrentStation || train.NextStation || train.LastStation || 'Unknown';
        const nextStation = train.NextStation || 'Unknown';
        const eta = train.NextStationETA || '--:--';
        
        // Check if train has reached the station (within 2 minutes of ETA)
        let hasReachedStation = false;
        if (eta && eta !== '--:--') {
            const etaMinutes = this.parseTimeToMinutes(eta);
            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            
            if (etaMinutes !== null) {
                let minutesUntilArrival = etaMinutes - currentMinutes;
                if (minutesUntilArrival < 0) minutesUntilArrival += 1440; // Handle day boundary
                
                // Train has reached if within 2 minutes or passed
                if (minutesUntilArrival <= 2) {
                    hasReachedStation = true;
                }
            }
        }
        
        // Improved direction detection logic
        const trainNameUp = String(trainName).toUpperCase();
        const trainNumberUp = String(trainNumber).toUpperCase();
        let direction = train.Direction || 'Unknown';
        
        if (direction === 'Unknown') {
            // Check both train name and train number for UP/DOWN indicators
            if (trainNameUp.includes('UP') || trainNumberUp.includes('UP')) {
                direction = 'UP';
            } else if (trainNameUp.includes('DOWN') || trainNameUp.includes('DN') || 
                       trainNumberUp.includes('DOWN') || trainNumberUp.includes('DN')) {
                direction = 'DOWN';
            } else {
                // Fallback to train number parity only if no text indicators
                const numericPart = parseInt(String(trainNumber).replace(/\D/g, ''));
                if (!isNaN(numericPart)) {
                    direction = (numericPart % 2 === 0) ? 'UP' : 'DOWN';
                }
            }
        }

        // Update panel title
        const titleElement = document.getElementById('selectedTrainName');
        if (titleElement) {
            titleElement.textContent = `${trainName} (#${trainNumber})`;
        }

        // Update stats
        const speedElement = document.getElementById('trainSpeed');
        if (speedElement) speedElement.textContent = `${speed} km/h`;

        const statusElement = document.getElementById('trainStatus');
        if (statusElement) statusElement.textContent = `${status} (${direction})`;

        const nextStationElement = document.getElementById('nextStation');
        // Only show "Current: " prefix if train has reached the station
        if (nextStationElement) {
            if (hasReachedStation) {
                nextStationElement.textContent = `Current: ${currentLocation} → ${nextStation}`;
            } else {
                nextStationElement.textContent = `${nextStation}`;
            }
        }

        const etaElement = document.getElementById('trainETA');
        if (etaElement) etaElement.textContent = eta;
    }

    startMapAutoRefresh() {
        if (this.mapRefreshInterval) {
            clearInterval(this.mapRefreshInterval);
        }

        this.mapRefreshInterval = setInterval(() => {
            this.refreshMapData();
        }, 10000); // Refresh every 10 seconds
    }

    stopMapAutoRefresh() {
        if (this.mapRefreshInterval) {
            clearInterval(this.mapRefreshInterval);
            this.mapRefreshInterval = null;
        }
    }

    async refreshMapData() {
        if (this.currentScreen !== 'mapScreen') return;

        try {
            const response = await fetch(getAPIUrl('live'));
            const data = await response.json();
            
            if (data.success && data.data) {
                console.log(`🔄 Map refresh - Raw data: ${data.data.length} trains`);
                
                // Apply the same filtering logic as loadMapTrains
                let filteredTrains = data.data;
                
                // 1. Filter by recent dates (last 3 days)
                filteredTrains = this.filterByRecentDates(filteredTrains, 3);
                console.log(`📅 Map refresh - After date filter: ${filteredTrains.length} trains`);
                
                // 2. Filter duplicate trains
                filteredTrains = this.filterDuplicateTrains(filteredTrains);
                console.log(`🔄 Map refresh - After duplicate filter: ${filteredTrains.length} trains`);
                
                // 3. Filter completed journeys
                filteredTrains = this.filterCompletedJourneys(filteredTrains);
                console.log(`🏁 Map refresh - After completed journeys filter: ${filteredTrains.length} trains`);
                
                // 4. Filter unrealistic delays
                filteredTrains = this.filterUnrealisticDelays(filteredTrains);
                console.log(`⏰ Map refresh - After unrealistic delays filter: ${filteredTrains.length} trains`);
                
                this.trainData.active = filteredTrains;
                
                if (this.selectedTrain) {
                    console.log(`🔍 Looking for selected train: ${this.selectedTrain.TrainName} (InnerKey: ${this.selectedTrain.InnerKey})`);
                    
                    // First, try to find exact match by InnerKey
                    let updatedTrain = filteredTrains.find(t => 
                        t.InnerKey === this.selectedTrain.InnerKey
                    );
                    
                    // If not found by InnerKey, find most recent instance of same train number
                    if (!updatedTrain) {
                        console.log(`⚠️ Exact InnerKey not found, looking for most recent instance of train #${this.selectedTrain.TrainNumber}`);
                        const sameTrainInstances = filteredTrains.filter(t => 
                            t.TrainNumber === this.selectedTrain.TrainNumber
                        );
                        
                        if (sameTrainInstances.length > 0) {
                            // Sort by date and take most recent
                            sameTrainInstances.sort((a, b) => {
                                const dateA = this.extractDateFromInnerKey(a.InnerKey, a.TrainNumber);
                                const dateB = this.extractDateFromInnerKey(b.InnerKey, b.TrainNumber);
                                if (dateA && dateB) {
                                    return dateB.sortKey.localeCompare(dateA.sortKey);
                                }
                                return 0;
                            });
                            updatedTrain = sameTrainInstances[0];
                            console.log(`✅ Found most recent instance: InnerKey ${updatedTrain.InnerKey}`);
                        }
                    }
                    
                    if (updatedTrain) {
                        console.log(`✅ Updating selected train: ${updatedTrain.TrainName} (InnerKey: ${updatedTrain.InnerKey})`);
                        this.selectedTrain = updatedTrain;
                        this.updateMapWithSelectedTrain(updatedTrain);
                        this.updateTrainInfoPanel();
                    } else {
                        console.log('⚠️ Selected train completely filtered out (no instances found)');
                        console.log('🔄 Clearing train selection and showing all trains');
                        // Train was filtered out completely - clear selection and show all trains
                        this.selectedTrain = null;
                        this.closeTrainInfo();
                        this.showTrainSelectionPanel();
                        this.updateMapWithTrains(filteredTrains);
                    }
                } else {
                    // Update all trains on map
                    this.updateMapWithTrains(filteredTrains);
                }
            }
        } catch (error) {
            console.error('❌ Error refreshing map data:', error);
        }
    }

    closeTrainSelection() {
        this.hideTrainSelectionPanel();
    }

    closeTrainInfo() {
        console.log('🚪 Closing train info panel');
        this.hideTrainInfoPanel();
        this.selectedTrain = null;
        this.stopMapAutoRefresh();
        this.updateMapWithTrains(this.trainData.active);
        // Show the train selection panel when closing train info
        this.showTrainSelectionPanel();
    }

    showTrainDetails() {
        if (this.selectedTrain) {
            const trainId = this.selectedTrain.InnerKey || this.selectedTrain.TrainId;
            this.openTrainDetails(trainId);
        }
    }

    // ========== NOTIFICATION METHODS ==========
    
    async requestNotificationPermission() {
        if (!('Notification' in window)) {
            console.log('📵 This browser does not support notifications');
            return false;
        }

        if (Notification.permission === 'granted') {
            console.log('✅ Notification permission already granted');
            return true;
        }

        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                console.log('✅ Notification permission granted');
                return true;
            }
        }

        console.log('❌ Notification permission denied');
        return false;
    }

    loadNotificationsFromStorage() {
        try {
            const stored = localStorage.getItem('trainNotifications');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error loading notifications:', error);
            return [];
        }
    }

    saveNotificationsToStorage() {
        try {
            localStorage.setItem('trainNotifications', JSON.stringify(this.notifications));
        } catch (error) {
            console.error('Error saving notifications:', error);
        }
    }

    addNotification(trainId, trainName, stationName, stationId, minutesBefore) {
        const notification = {
            id: Date.now().toString(),
            trainId,
            trainName,
            stationName,
            stationId,
            minutesBefore,
            createdAt: new Date().toISOString(),
            triggered: false
        };

        this.notifications.push(notification);
        this.saveNotificationsToStorage();
        console.log(`🔔 Notification added: ${trainName} - ${stationName} (${minutesBefore} min before)`);
        
        return notification;
    }

    removeNotification(notificationId) {
        this.notifications = this.notifications.filter(n => n.id !== notificationId);
        this.saveNotificationsToStorage();
        console.log(`🔕 Notification removed: ${notificationId}`);
    }

    getActiveNotifications(trainId) {
        return this.notifications.filter(n => 
            n.trainId === trainId && !n.triggered
        );
    }

    startNotificationMonitoring() {
        // Check notifications every 30 seconds
        this.notificationCheckInterval = setInterval(() => {
            this.checkNotifications();
        }, 30000);
        
        // Also check immediately
        this.checkNotifications();
    }

    async checkNotifications() {
        if (this.notifications.length === 0) return;

        // Get active trains data
        if (!this.trainData || !this.trainData.active || this.trainData.active.length === 0) {
            return;
        }

        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const notificationsToRemove = [];

        for (const notification of this.notifications) {
            // Find the train
            const train = this.trainData.active.find(t => 
                String(t.InnerKey) === String(notification.trainId) ||
                String(t.TrainId) === String(notification.trainId)
            );

            if (!train) continue;

            // Check if this station is the next station
            const isNextStation = train.NextStation && (
                notification.stationName.toLowerCase().includes(train.NextStation.toLowerCase()) ||
                train.NextStation.toLowerCase().includes(notification.stationName.toLowerCase())
            );

            if (isNextStation && train.NextStationETA && train.NextStationETA !== '--:--') {
                // Use the actual ETA (with delay)
                const etaMinutes = this.parseTimeToMinutes(train.NextStationETA);
                
                if (etaMinutes !== null) {
                    let minutesUntilArrival = etaMinutes - currentMinutes;
                    const rawMinutesUntilArrival = minutesUntilArrival; // Keep original for passed check
                    if (minutesUntilArrival < 0) minutesUntilArrival += 1440;

                    console.log(`🔔 Checking: ${notification.stationName}, ETA: ${train.NextStationETA}, Minutes until arrival: ${minutesUntilArrival} min, Trigger at: ${notification.minutesBefore} min`);

                    // Check if ETA has already passed (train likely arrived or is arriving)
                    // If raw minutes is negative and more than 2 hours in the past, the ETA has passed
                    if (rawMinutesUntilArrival < -120) {
                        console.log(`🗑️ Station ${notification.stationName} ETA has passed (${rawMinutesUntilArrival} min ago), removing notification`);
                        notificationsToRemove.push(notification.id);
                        continue;
                    }

                    // Trigger notification if within the window and not already triggered
                    if (!notification.triggered && minutesUntilArrival <= notification.minutesBefore && minutesUntilArrival >= notification.minutesBefore - 1) {
                        this.triggerNotification(notification, train, minutesUntilArrival);
                    }
                }
            } else {
                // Station is not the next station - check if train has passed it
                // Get train schedule to check if station was already passed
                try {
                    const schedResponse = await fetch(getAPIPath(`/api/train/${train.TrainNumber}`));
                    const schedData = await schedResponse.json();

                    if (schedData.success && schedData.data?.schedule) {
                        const station = schedData.data.schedule.find(s => 
                            String(s.StationId) === String(notification.stationId)
                        );

                        if (station) {
                            // Check if actual departure time exists (station passed)
                            const hasActualDeparture = station.ActualDeparture && station.ActualDeparture !== '--:--';
                            if (hasActualDeparture) {
                                console.log(`🗑️ Station ${notification.stationName} already passed, removing notification`);
                                notificationsToRemove.push(notification.id);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error checking notification:', error);
                }
            }
        }

        // Remove notifications for stations that have been passed
        notificationsToRemove.forEach(id => {
            this.removeNotification(id);
        });
        
        // Note: UI refresh now happens only after notification is pushed (in triggerNotification)
        // This prevents unnecessary UI updates during regular 10-second data refresh cycles
        console.log(`✅ Notification check complete. Removed: ${notificationsToRemove.length} passed stations`);
    }

    triggerNotification(notification, train, minutesUntilArrival) {
        if ('Notification' in window && Notification.permission === 'granted') {
            const title = `🚂 ${notification.trainName}`;
            const body = `Arriving at ${notification.stationName} in ${Math.round(minutesUntilArrival)} minutes`;
            
            const notif = new Notification(title, {
                body,
                icon: '/locomotive_1f682.png',
                badge: '/locomotive_1f682.png',
                tag: notification.id,
                requireInteraction: false,
                silent: false
            });

            notif.onclick = () => {
                window.focus();
                this.openTrainDetails(notification.trainId);
                notif.close();
            };

            // Mark as triggered
            notification.triggered = true;
            this.saveNotificationsToStorage();

            console.log(`🔔 Notification triggered: ${notification.trainName} - ${notification.stationName}`);
            
            // Refresh notification UI after pushing notification
            this.refreshNotificationUIAfterPush(train);
        }
    }
    
    async refreshNotificationUIAfterPush(train) {
        console.log('🔄 Refreshing notification UI after push');
        
        // Only refresh if on train details screen
        if (this.currentScreen === 'liveTrainDetail' && this.currentTrainData) {
            try {
                const schedResponse = await fetch(getAPIPath(`/api/train/${this.currentTrainData.TrainNumber}`));
                const schedData = await schedResponse.json();
                
                if (schedData.success && schedData.data?.schedule) {
                    const existingSettings = document.querySelector('.notification-settings');
                    if (existingSettings) {
                        existingSettings.remove();
                    }
                    this.showNotificationSettings(this.currentTrainData, schedData.data.schedule);
                }
            } catch (error) {
                console.error('Error refreshing notification UI:', error);
            }
        }
    }

    updateActiveNotificationsList(train) {
        // Only update the active notifications list without recreating the entire section
        const existingNotifications = this.getActiveNotifications(train.InnerKey || train.TrainId);
        const notificationHeader = document.querySelector('.notification-header-content');
        
        if (notificationHeader) {
            // Update header summary
            let headerSummary = '';
            if (existingNotifications.length > 0) {
                if (existingNotifications.length === 1) {
                    headerSummary = `<span class="notification-count">${existingNotifications[0].stationName} (${existingNotifications[0].minutesBefore} min)</span>`;
                } else {
                    headerSummary = `<span class="notification-count">${existingNotifications.length} active notifications</span>`;
                }
            } else {
                headerSummary = `<span class="notification-subtitle">Tap to set up notifications</span>`;
            }
            
            // Update only the subtitle/count part
            const existingSubtitle = notificationHeader.querySelector('.notification-subtitle, .notification-count');
            if (existingSubtitle) {
                existingSubtitle.outerHTML = headerSummary;
            }
        }
        
        console.log('✅ Active notifications list updated without recreating accordion');
    }

    showNotificationSettings(train, stations, preserveState = false) {
        console.log(`🔔 showNotificationSettings called (preserveState: ${preserveState})`);
        
        // Request notification permission if not already granted (user gesture required)
        if ('Notification' in window && Notification.permission === 'default') {
            console.log('🔔 Notification permission not yet requested, will request on user interaction');
            // Permission will be requested when user clicks "Add Notification" button
        }
        
        // Start notification monitoring if permission is granted
        if ('Notification' in window && Notification.permission === 'granted' && !this.notificationCheckInterval) {
            this.startNotificationMonitoring();
        }
        
        // Check if notification settings already exist
        const existingSettings = document.querySelector('.notification-settings');
        
        // If preserveState is true and settings exist, only update the active notifications list
        if (preserveState && existingSettings) {
            console.log('✅ Preserving notification accordion state - only updating active notifications');
            this.updateActiveNotificationsList(train);
            return;
        }
        
        // Remove existing notification settings to prevent duplication
        if (existingSettings) {
            console.log('🗑️ Removing existing notification settings to recreate');
            existingSettings.remove();
        }

        const existingNotifications = this.getActiveNotifications(train.InnerKey || train.TrainId);
        
        // Filter out passed stations - only show upcoming stations
        const nextLocation = train.NextStation || '';
        let currentStationIndex = -1;
        
        // Find the current/next station index
        if (nextLocation) {
            currentStationIndex = stations.findIndex(s => {
                const stationName = s.StationName || s.name || '';
                return stationName.toLowerCase().includes(nextLocation.toLowerCase()) ||
                       nextLocation.toLowerCase().includes(stationName.toLowerCase());
            });
        }
        
        // If we found the next station, filter to show only upcoming stations (including next station)
        const upcomingStations = currentStationIndex >= 0 
            ? stations.slice(currentStationIndex) 
            : stations;
        
        console.log(`🔔 Notification stations: Total ${stations.length}, Current index: ${currentStationIndex}, Upcoming: ${upcomingStations.length}`);
        
        // Create summary text for header
        let headerSummary = '';
        if (existingNotifications.length > 0) {
            if (existingNotifications.length === 1) {
                headerSummary = `<span class="notification-count">${existingNotifications[0].stationName} (${existingNotifications[0].minutesBefore} min)</span>`;
            } else {
                headerSummary = `<span class="notification-count">${existingNotifications.length} active notifications</span>`;
            }
        } else {
            headerSummary = `<span class="notification-subtitle">Tap to set up notifications</span>`;
        }
        
        let html = `
            <div class="notification-settings accordion">
                <div class="notification-header">
                    <div class="notification-header-content">
                        <div class="notification-title">
                            <span class="notification-icon">🔔</span>
                            <span>Arrival Notifications</span>
                        </div>
                        ${headerSummary}
                    </div>
                    <div class="notification-toggle">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                </div>
                
                <div class="notification-body">
                    <p class="notification-description">Get notified when the train is arriving at a station</p>
                    
                    <div class="notification-form">
                        <div class="form-group">
                            <label>Select Station</label>
                            <select id="notificationStation" class="form-select">
                                <option value="">Choose a station...</option>
                                ${upcomingStations.map(station => `
                                    <option value="${station.StationId}" data-name="${station.StationName}">
                                        ${station.StationName}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>Notify Before</label>
                            <div class="time-options">
                                <button class="time-option" data-minutes="5">5 min</button>
                                <button class="time-option" data-minutes="15">15 min</button>
                                <button class="time-option" data-minutes="30">30 min</button>
                                <button class="time-option" data-minutes="45">45 min</button>
                            </div>
                        </div>
                        
                        <button class="btn-primary btn-add-notification" disabled>
                            <span class="icon">➕</span> Add Notification
                        </button>
                    </div>
                    
                    ${existingNotifications.length > 0 ? `
                        <div class="active-notifications">
                            <h4>Active Notifications</h4>
                            <div class="notification-list">
                                ${existingNotifications.map(notif => `
                                    <div class="notification-item" data-id="${notif.id}">
                                        <div class="notification-info">
                                            <div class="notification-station">${notif.stationName}</div>
                                            <div class="notification-time">${notif.minutesBefore} minutes before</div>
                                        </div>
                                        <button class="btn-remove-notification" data-id="${notif.id}">
                                            <span class="icon">🗑️</span>
                                        </button>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        // Insert inside train-status-card, after status-indicator
        const statusIndicator = document.querySelector('.train-status-card .status-indicator');
        if (statusIndicator) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            
            // Insert after the status-indicator
            statusIndicator.parentNode.insertBefore(tempDiv.firstElementChild, statusIndicator.nextSibling);
            
            // Add event listeners
            this.setupNotificationEventListeners(train, stations);
            this.setupAccordionToggle();
        }
    }

    setupAccordionToggle() {
        const header = document.querySelector('.notification-header');
        const accordion = document.querySelector('.notification-settings.accordion');
        
        if (header && accordion) {
            header.addEventListener('click', () => {
                accordion.classList.toggle('open');
            });
        }
    }

    setupNotificationEventListeners(train, stations) {
        const stationSelect = document.getElementById('notificationStation');
        const timeOptions = document.querySelectorAll('.time-option');
        const addBtn = document.querySelector('.btn-add-notification');
        let selectedStation = null;
        let selectedMinutes = null;

        // Station selection
        if (stationSelect) {
            stationSelect.addEventListener('change', (e) => {
                const option = e.target.selectedOptions[0];
                if (option.value) {
                    selectedStation = {
                        id: option.value,
                        name: option.dataset.name
                    };
                    this.checkAddButtonState(addBtn, selectedStation, selectedMinutes);
                } else {
                    selectedStation = null;
                    this.checkAddButtonState(addBtn, selectedStation, selectedMinutes);
                }
            });
        }

        // Time option selection
        timeOptions.forEach(btn => {
            btn.addEventListener('click', () => {
                timeOptions.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                selectedMinutes = parseInt(btn.dataset.minutes);
                this.checkAddButtonState(addBtn, selectedStation, selectedMinutes);
            });
        });

        // Add notification button
        if (addBtn) {
            addBtn.addEventListener('click', async () => {
                if (selectedStation && selectedMinutes) {
                    // Request notification permission if needed (user gesture - allowed here!)
                    if ('Notification' in window && Notification.permission === 'default') {
                        console.log('🔔 Requesting notification permission...');
                        const permissionGranted = await this.requestNotificationPermission();
                        if (!permissionGranted) {
                            this.showToast('Please enable notifications to use this feature');
                            return;
                        }
                        // Start monitoring if permission just granted
                        if (!this.notificationCheckInterval) {
                            this.startNotificationMonitoring();
                        }
                    }
                    
                    if (!('Notification' in window) || Notification.permission !== 'granted') {
                        this.showToast('Notification permission is required');
                        return;
                    }
                    
                    this.addNotification(
                        train.InnerKey || train.TrainId,
                        train.TrainName,
                        selectedStation.name,
                        selectedStation.id,
                        selectedMinutes
                    );
                    
                    // Refresh the notification settings UI
                    const notificationSettings = document.querySelector('.notification-settings');
                    if (notificationSettings) {
                        notificationSettings.remove();
                    }
                    this.showNotificationSettings(train, stations);
                    
                    // Close accordion after adding notification
                    setTimeout(() => {
                        const accordion = document.querySelector('.notification-settings.accordion');
                        if (accordion) {
                            accordion.classList.remove('open');
                        }
                    }, 100);
                    
                    // Show success message
                    this.showToast(`Notification added for ${selectedStation.name}`);
                }
            });
        }

        // Remove notification buttons
        document.querySelectorAll('.btn-remove-notification').forEach(btn => {
            btn.addEventListener('click', () => {
                const notificationId = btn.dataset.id;
                this.removeNotification(notificationId);
                
                // Refresh the notification settings UI
                const notificationSettings = document.querySelector('.notification-settings');
                if (notificationSettings) {
                    notificationSettings.remove();
                }
                this.showNotificationSettings(train, stations);
                
                this.showToast('Notification removed');
            });
        });
    }

    checkAddButtonState(addBtn, selectedStation, selectedMinutes) {
        if (addBtn) {
            if (selectedStation && selectedMinutes) {
                addBtn.disabled = false;
            } else {
                addBtn.disabled = true;
            }
        }
    }

    showToast(message) {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.textContent = message;
        document.body.appendChild(toast);

        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 10);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}
// Navigation functions
function navigateTo(screen) {
    if (window.mobileApp) {
        window.mobileApp.navigateTo(screen);
    }
}

// Global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    if (window.mobileApp) {
        window.mobileApp.showError('An unexpected error occurred');
    }
});

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    window.mobileApp = new MobileApp();
});
