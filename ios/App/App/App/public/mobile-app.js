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
        
        // Load live trains data for home screen
        this.loadLiveTrains();
        
        // Load schedule data in background
        await this.loadScheduledTrainsForHome();
        
        // Request user location
        this.getUserLocation();
        
        // Start live updates feed
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

        // Handle browser back/forward buttons
        window.addEventListener('popstate', (event) => {
            console.log('🔙 Browser back button pressed', event.state);
            if (event.state && event.state.screen) {
                this.navigateToScreen(event.state.screen, false);
            } else {
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

        // Special handling for map screen - always go to home
        if (this.currentScreen === 'mapScreen') {
            console.log('⬅️ From map screen, going to home');
            this.navigateToScreen('home', false);
            return;
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
            console.log('🌐 Loading live trains...');
            const response = await fetch(getAPIUrl('live'));
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('📊 Live trains API response:', { success: data.success, dataLength: data.data?.length });
            
            if (data.success && data.data && data.data.length > 0) {
                this.trainData.active = data.data;
                console.log('✅ Live trains loaded successfully:', data.data.length, 'trains');
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
            const trainDate = this.getTrainDate(train.LastUpdated || train.__last_updated || train.last_updated);

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
            const trainDate = this.getTrainDate(train.LastUpdated || train.__last_updated || train.last_updated);

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

            // Find train in live data
            const train = this.trainData.active.find(t =>
                String(t.InnerKey) === String(trainId) ||
                String(t.TrainId) === String(trainId) ||
                String(t.TrainNumber) === String(trainId)
            );

            if (!train) {
                throw new Error(`Train ${trainId} not found`);
            }

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
        // Clear any existing interval
        this.stopDetailAutoRefresh();
        
        // Start the live clock immediately
        this.startTrainDetailClock();

        // Update progress bar every 1 second for smooth real-time progress (like live map)
        this.progressBarInterval = setInterval(() => {
            if (this.currentScreen === 'liveTrainDetail' && this.currentTrainData && this.currentRouteStations) {
                console.log('⏱️ Updating progress bar based on clock time...');
                this.updateProgressBar(this.currentRouteStations, this.getCurrentStationIndex(), this.currentTrainData);
            }
        }, 1000); // 1 second for smooth real-time updates

        // Refresh full data every 10 seconds
        this.detailRefreshInterval = setInterval(() => {
            if (this.currentScreen === 'liveTrainDetail' && this.currentTrainData) {
                console.log('🔄 Auto-refreshing train details...');
                this.refreshTrainDetails();
            }
        }, 10000); // 10 seconds
    }

    stopDetailAutoRefresh() {
        if (this.detailRefreshInterval) {
            clearInterval(this.detailRefreshInterval);
            this.detailRefreshInterval = null;
        }
        if (this.progressBarInterval) {
            clearInterval(this.progressBarInterval);
            this.progressBarInterval = null;
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

    updateProgressBarRealtime() {
        // Get current route stations and train data
        if (!this.currentTrainData || !this.currentRouteStations) {
            console.log('⚠️ No current train data or stations for progress update');
            return;
        }

        // Get current clock time
        const now = new Date();
        const currentTime = this.getCurrentTime();
        console.log(`🕐 Clock time: ${currentTime} (${now.toLocaleTimeString()})`);

        // Find current station index using the same logic as populateRouteStations
        const currentLocation = this.currentTrainData.CurrentStation ||
                               this.currentTrainData.LastStation ||
                               this.currentTrainData.NextStation || '';
        const nextLocation = this.currentTrainData.NextStation || '';
        const stations = this.currentRouteStations;

        let currentStationIndex = -1;
        if (currentLocation) {
            currentStationIndex = stations.findIndex(s => {
                const stationName = s.StationName || s.name || '';
                return stationName.toLowerCase().includes(currentLocation.toLowerCase()) ||
                       currentLocation.toLowerCase().includes(stationName.toLowerCase());
            });
        }
        
        // If current station not found, try to find based on next station (go back one)
        if (currentStationIndex === -1 && nextLocation) {
            const nextStationIndex = stations.findIndex(s => {
                const stationName = s.StationName || s.name || '';
                return stationName.toLowerCase().includes(nextLocation.toLowerCase()) ||
                       nextLocation.toLowerCase().includes(stationName.toLowerCase());
            });
            if (nextStationIndex > 0) {
                currentStationIndex = nextStationIndex - 1;
            }
        }
        
        // Fallback: if still not found, assume first station
        if (currentStationIndex === -1) {
            currentStationIndex = 0;
        }

        // Log the update with clock time
        const currentStation = stations[currentStationIndex];
        const nextStation = currentStationIndex < stations.length - 1 ? stations[currentStationIndex + 1] : null;
        console.log(`📊 Progress update at ${currentTime}:`);
        console.log(`   Current: ${currentStation?.StationName || 'Unknown'}`);
        console.log(`   Next: ${nextStation?.StationName || 'Final'}`);
        console.log(`   ETA: ${this.currentTrainData.NextStationETA || 'N/A'}`);

        // Update progress bar with current clock time
        this.updateProgressBar(stations, currentStationIndex, this.currentTrainData);
    }

    async refreshTrainDetails() {
        try {
            // Reload live trains data
            await this.loadLiveTrains();

            // Find updated train data
            const trainId = this.currentTrainData.InnerKey || this.currentTrainData.TrainId;
            const updatedTrain = this.trainData.active.find(t =>
                String(t.InnerKey) === String(trainId) ||
                String(t.TrainId) === String(trainId)
            );

            if (updatedTrain) {
                this.currentTrainData = updatedTrain;
                this.lastUpdatedTime = new Date();
                this.trainDetailLastUpdatedTime = new Date();
                this.populateTrainDetails(updatedTrain);

                // Reload schedule if needed
                if (updatedTrain.TrainNumber) {
                    const schedResponse = await fetch(getAPIPath(`/api/train/${updatedTrain.TrainNumber}`));
                    const schedData = await schedResponse.json();

                    if (schedData.success && schedData.data?.schedule) {
                        this.populateRouteStations(schedData.data.schedule, updatedTrain);
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error refreshing train details:', error);
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
        html += `
            <div class="route-line">
                <div class="progress-indicator" id="progressIndicator" style="width: 0%"></div>
            </div>
            <div class="train-locomotive-icon" id="trainLocomotiveIcon" style="left: 0%;">
                <img src="/locomotive_1f682.png" alt="Train" />
            </div>
        `;

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

        // Also populate vertical route stations
        this.populateVerticalRouteStations(stations, train);
        
        // Update progress bar - use the last completed station index
        // If train has reached next station, progress should stop at that station
        // Otherwise, progress shows movement towards next station
        let progressStationIndex = hasReachedNextStation ? nextStationIndex : (nextStationIndex > 0 ? nextStationIndex - 1 : 0);
        console.log(`📊 Progress bar index: ${progressStationIndex} (${hasReachedNextStation ? 'reached' : 'traveling to'} next station)`);
        
        // Update progress bar
        this.updateProgressBar(stations, progressStationIndex, train);
        
        // Scroll to current station
        setTimeout(() => {
            this.scrollToCurrentStation();
        }, 100);
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
        if (!stations || stations.length === 0) return;

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
        }
        
        if (locomotiveIcon) {
            locomotiveIcon.style.left = `${progressPercentage}%`;
            
            // Create or update locomotive popover
            this.updateLocomotivePopover(locomotiveIcon, train, stations, currentStationIndex);
            
            // Keep locomotive in viewport
            this.scrollLocomotiveIntoView(locomotiveIcon);
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
        
        // Get locomotive position relative to container
        const locomotiveRect = locomotiveIcon.getBoundingClientRect();
        const containerRect = routeStations.getBoundingClientRect();
        
        // Calculate locomotive position relative to scrollable container
        const locomotiveLeft = locomotiveIcon.offsetLeft;
        const containerWidth = routeStations.clientWidth;
        const scrollLeft = routeStations.scrollLeft;
        
        // Calculate the center position we want the locomotive to be at
        const targetScrollLeft = locomotiveLeft - (containerWidth / 2);
        
        // Smooth scroll to keep locomotive centered
        routeStations.scrollTo({
            left: targetScrollLeft,
            behavior: 'smooth'
        });
        
        console.log(`🎯 Scrolling locomotive into view: Left=${locomotiveLeft}px, Target=${targetScrollLeft}px`);
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
        
        // Get next station info
        const nextStationIndex = Math.min(currentStationIndex + 1, stations.length - 1);
        const nextStation = stations[nextStationIndex];
        const nextStationName = nextStation?.StationName || 'Unknown';
        
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
        
        // Add rows directly
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
        
        // Popover will automatically position itself via CSS (bottom: 100% of locomotive)
        console.log(`🎈 Popover created and will auto-position via CSS`);
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

            // Get scheduled time for next station
            const scheduledTime = this.getScheduledTimeForNextStation(train);
            if (!scheduledTime || scheduledTime === 'Loading...' || scheduledTime === 'Schedule N/A' || scheduledTime.startsWith('ETA')) {
                return null;
            }

            // Parse both times to minutes
            const etaMinutes = this.parseTimeToMinutes(train.NextStationETA);
            const scheduledMinutes = this.parseTimeToMinutes(scheduledTime);

            if (etaMinutes === null || scheduledMinutes === null) {
                return null;
            }

            // Calculate delay in minutes (ETA - Scheduled)
            let delayMinutes = etaMinutes - scheduledMinutes;

            // Handle day boundary crossing with more conservative approach
            if (delayMinutes > 360) { // More than 6 hours ahead
                delayMinutes -= 1440; // Subtract 24 hours
            } else if (delayMinutes < -360) { // More than 6 hours behind
                delayMinutes += 1440; // Add 24 hours
            }

            console.log(`📊 Delay calculation: Scheduled: ${scheduledTime}, ETA: ${train.NextStationETA}, Delay: ${delayMinutes}m`);
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

    getTrainDate(lastUpdated) {
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
            return;
        }
        
        const totalTrains = this.trainData.active.length;
        const onTimeTrains = this.trainData.active.filter(t => (t.LateBy || 0) <= 5).length;
        const delayedTrains = totalTrains - onTimeTrains;
        
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
            const trainDate = this.getTrainDate(train.LastUpdated || train.__last_updated || train.last_updated);

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
                            <span class="info-text">Current Location: ${location}</span>
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
            const response = await fetch(getAPIUrl('schedule'));
            const data = await response.json();
            
            if (data.success && data.data) {
                // Store schedule data for use in other methods
                this.scheduleData = data.data;
                this.populateScheduledTrains(data.data);
                console.log('📅 Schedule data loaded, refreshing live trains with schedule info');
                
                // If live trains are already loaded, refresh them with schedule data
                if (this.trainData && this.trainData.active) {
                    this.populateLiveTrains();
                }
            }
        } catch (error) {
            console.error('❌ Error loading scheduled trains for home:', error);
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
            
            // Check if this train has live data
            const liveTrainData = this.findLiveTrainData(train.trainNumber);
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

        // Get all available live trains (no date filtering - show most recent)
        const allAvailableTrains = this.trainData.active || [];
        console.log('🔍 Available trains for favorites:', allAvailableTrains.length);

        // Sort by most recent train date (using LastUpdated which determines train date)
        const recentLiveTrains = [...allAvailableTrains].sort((a, b) => {
            // Use LastUpdated for train date comparison (same as shown on train cards)
            const timeA = new Date(a.LastUpdated || a.__last_updated || a.last_updated || a.UpdateTime || a.updateTime || Date.now());
            const timeB = new Date(b.LastUpdated || b.__last_updated || b.last_updated || b.UpdateTime || b.updateTime || Date.now());

            // Handle invalid dates by putting them at the end
            const timeAValid = !isNaN(timeA.getTime()) && timeA.getFullYear() !== 1970;
            const timeBValid = !isNaN(timeB.getTime()) && timeB.getFullYear() !== 1970;

            if (timeAValid && !timeBValid) return -1;
            if (!timeAValid && timeBValid) return 1;
            if (!timeAValid && !timeBValid) return 0;

            return timeB - timeA; // Most recent first
        });

        console.log('📅 All trains available for favorites:', recentLiveTrains.length);

        // Get live train data to show current info for favorite trains
        this.favoriteTrains.forEach(trainNumber => {
            console.log(`🔍 Looking for favorite train number: "${trainNumber}" (type: ${typeof trainNumber})`);

            // Find all matching trains for this train number
            const matchingTrains = recentLiveTrains.filter(train => {
                const trainNum = String(train.TrainNumber || train.trainNumber);
                const favoriteNum = String(trainNumber);
                const matches = trainNum === favoriteNum;
                if (!matches && recentLiveTrains.indexOf(train) < 3) {
                    console.log(`  Comparing: "${trainNum}" vs "${favoriteNum}" = ${matches}`);
                }
                return matches;
            });

            console.log(`  Found ${matchingTrains.length} matching trains`);

            // Show only last (most recent) live train - limit 1 train per category (train number)
            const liveTrainData = matchingTrains.length > 0 ? matchingTrains[0] : null;

            console.log(`⭐ Checking favorite train ${trainNumber}:`, liveTrainData ? 'FOUND' : 'NOT FOUND');
            
            // Try to find schedule data for this train
            const scheduleTrainData = this.scheduleData?.find(train =>
                String(train.trainNumber || train.TrainNumber) === String(trainNumber)
            );
            
            // Show favorite trains with their best available data (live or schedule)
            if (!liveTrainData && !scheduleTrainData) {
                console.log(`⚪ Skipping favorite train ${trainNumber} - no data available`);
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
            
            console.log(`⭐ Showing favorite train: ${trainName} (${isLive ? 'LIVE' : 'SCHEDULED'})`);
            
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
                        <div class="status-info">${statusText}</div>
                    </div>
                </div>
            `;
        });

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
            
            // Find corresponding live train data
            const liveTrainData = this.findLiveTrainData(train.trainNumber);
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
            const trainDate = liveTrainData ? this.getTrainDate(liveTrainData.LastUpdated) : new Date().toLocaleDateString('en-GB', {day: '2-digit', month: '2-digit', year: 'numeric'});
            
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
                        <div class="section-header">🔴 Live Information</div>
                        <div class="train-info-grid">
                            <div class="info-row">
                                <span class="info-icon">📍</span>
                                <span class="info-text">Current Location: ${currentStation}</span>
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
        
        return this.trainData.active.find(train => 
            String(train.TrainNumber) === String(trainNumber) ||
            String(train.TrainName).toLowerCase().includes(String(trainNumber).toLowerCase())
        );
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
            const url = getAPIUrl('live');
            console.log('🔗 API URL:', url);
            const response = await fetch(url);
            const data = await response.json();
            
            console.log('📨 Live updates response:', { success: data.success, dataLength: data.data?.length || 0 });
            
            if (data.success && data.data) {
                this.populateLiveUpdates(data.data);
                console.log('📡 Live updates loaded successfully');
            } else {
                console.log('❌ Live updates API response failed or no data');
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
            // Sort by LastUpdated (train date) and take the most recent
            const sorted = trains.sort((a, b) => {
                const timeA = new Date(a.LastUpdated || a.__last_updated || a.last_updated || a.UpdateTime || a.updateTime || Date.now());
                const timeB = new Date(b.LastUpdated || b.__last_updated || b.last_updated || b.UpdateTime || b.updateTime || Date.now());
                return timeB - timeA; // Most recent first
            });
            const mostRecent = sorted[0];
            const trainDate = this.getTrainDate(mostRecent.LastUpdated || mostRecent.__last_updated || mostRecent.last_updated);
            console.log(`  ⭐ Selected favorite train ${trainNumber} - ${mostRecent.TrainName || 'Unknown'} (${trainDate}) [${trains.length} instances available]`);
            allFavoriteTrains.push(mostRecent); // Take the most recent
        });

        console.log('⭐ Most recent favorite trains selected:', allFavoriteTrains.length);

        // Sort remaining non-favorite trains by most recent train date
        const nonFavoriteTrains = liveTrains.filter(train => {
            const trainNumber = String(train.TrainNumber || train.trainNumber);
            return !this.isFavorite(trainNumber);
        });

        const sortedNonFavorites = [...nonFavoriteTrains].sort((a, b) => {
            // Use LastUpdated for train date comparison (same as shown on train cards)
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

        // 1. Always include favorite trains (highest priority)
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
        addUniqueTrains(favoriteTrains, '⭐ Favorites');

        // 2. If user has location, add location-based trains
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
                    this.loadMajorStations();
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

    loadStations() {
        const stationsContainer = document.getElementById('stationsContainer');
        if (stationsContainer) {
            stationsContainer.innerHTML = '<div class="loading">Loading stations...</div>';
            this.loadMajorStations();
        }
    }

    loadMajorStations() {
        const majorContainer = document.getElementById('majorStations');
        if (!majorContainer) return;
        
        const majorStations = [
            { name: 'Karachi Cantt', code: 'KCT', city: 'Karachi', trains: 25 },
            { name: 'Lahore Junction', code: 'LHR', city: 'Lahore', trains: 30 },
            { name: 'Rawalpindi', code: 'RWP', city: 'Rawalpindi', trains: 20 },
            { name: 'Multan Cantt', code: 'MTC', city: 'Multan', trains: 18 },
            { name: 'Faisalabad', code: 'FSD', city: 'Faisalabad', trains: 22 },
            { name: 'Peshawar Cantt', code: 'PSH', city: 'Peshawar', trains: 15 }
        ];
        
        let html = '';
        majorStations.forEach(station => {
            html += `
                <div class="station-card" onclick="mobileApp.openStationDetails('${station.code}')">
                    <div class="station-info">
                        <div class="station-name">${station.name}</div>
                        <div class="station-code">${station.code}</div>
                    </div>
                    <div class="station-meta">
                        <div class="city-name">${station.city}</div>
                        <div class="trains-count">${station.trains} trains</div>
                    </div>
                </div>
            `;
        });
        
        majorContainer.innerHTML = html;
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
        
        if (this.map) {
            console.log('🗺️ Map already initialized');
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
                this.trainData.active = data.data;
                this.populateTrainSelection();
                this.updateMapWithTrains(data.data);
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
                this.trainData.active = data.data;
                
                if (this.selectedTrain) {
                    // Update selected train data - use multiple identifiers for better matching
                    const updatedTrain = data.data.find(t => 
                        t.InnerKey === this.selectedTrain.InnerKey || 
                        t.TrainId === this.selectedTrain.TrainId ||
                        t.TrainNumber === this.selectedTrain.TrainNumber
                    );
                    
                    if (updatedTrain) {
                        console.log('🔄 Updating selected train:', updatedTrain.TrainName);
                        this.selectedTrain = updatedTrain;
                        this.updateMapWithSelectedTrain(updatedTrain);
                        this.updateTrainInfoPanel();
                    } else {
                        console.log('⚠️ Selected train not found in refresh data, keeping current selection');
                        // Keep current selection but update the map with current data
                        this.updateMapWithSelectedTrain(this.selectedTrain);
                    }
                } else {
                    // Update all trains on map
                    this.updateMapWithTrains(data.data);
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
        this.hideTrainInfoPanel();
        this.selectedTrain = null;
        this.stopMapAutoRefresh();
        this.updateMapWithTrains(this.trainData.active);
    }

    showTrainDetails() {
        if (this.selectedTrain) {
            const trainId = this.selectedTrain.InnerKey || this.selectedTrain.TrainId;
            this.openTrainDetails(trainId);
        }
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
