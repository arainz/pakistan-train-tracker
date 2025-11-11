/**
 * Official Schedule Fetching Service
 *
 * Two-step process to fetch official train schedules from Pakistan Railways API:
 * 1. POST to trainInfoList: Get train IDs (trainDirDayId) for each route
 * 2. GET to stopTimeTable: Fetch detailed schedule with station-by-station times
 *
 * Features:
 * - Fetches schedules for all routes with valid station code mappings
 * - Implements retry logic with exponential backoff
 * - Caches results to avoid repeated API calls
 * - Supports periodic background updates
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = 'https://isapi.pakrailways.gov.pk/v1/ticket';
const CACHE_DIR = path.join(__dirname, '..', '.server-data');
const PUBLIC_DATA_DIR = path.join(__dirname, '..', 'public', 'data');
const CACHE_FILE = path.join(CACHE_DIR, 'official-schedules-cache.json');
const SUMMARY_FILE = path.join(PUBLIC_DATA_DIR, 'trains-summary.json');
const SCHEDULES_FILE = path.join(PUBLIC_DATA_DIR, 'schedules.json');

// Configuration
const CONFIG = {
  maxRetries: 3,
  initialRetryDelay: 1000, // 1 second
  maxRetryDelay: 10000, // 10 seconds
  requestTimeout: 15000, // 15 seconds
  batchSize: 5, // Process train IDs in batches
  delayBetweenRequests: 100, // 100ms between requests to avoid throttling
  travelDate: new Date().toISOString().split('T')[0] // Today's date in YYYY-MM-DD format
};

/**
 * Sleep utility
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Load train summary with station codes
 */
async function loadTrainsSummary() {
  try {
    const data = fs.readFileSync(SUMMARY_FILE, 'utf-8');
    return JSON.parse(data).trains || [];
  } catch (error) {
    console.error('❌ Error loading trains summary:', error.message);
    return [];
  }
}

/**
 * Load local schedules for matching
 */
async function loadLocalSchedules() {
  try {
    const data = fs.readFileSync(SCHEDULES_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    // Handle both array format and Response wrapper format
    return Array.isArray(parsed) ? parsed : (parsed.Response || []);
  } catch (error) {
    console.error('❌ Error loading local schedules:', error.message);
    return [];
  }
}

/**
 * Step 1: Fetch train IDs for a route using station codes
 */
async function fetchTrainIdsForRoute(route, attempt = 1) {
  try {
    await sleep(CONFIG.delayBetweenRequests);

    const payload = {
      boardStationCode: route.StartStationCode,
      arrivalStationCode: route.EndStationCode,
      travelDate: CONFIG.travelDate
    };

    const response = await axios.post(
      `${API_BASE_URL}/trainInfo/trainInfoList`,
      payload,
      { timeout: CONFIG.requestTimeout }
    );

    if (response.data.code !== 200) {
      throw new Error(`API returned code: ${response.data.code}`);
    }

    const trainIds = (response.data.data || []).map(train => ({
      trainCode: train.trainDirDay?.trainCode, // e.g., "13UP", "14DN"
      trainDirDayId: train.trainDirDay?.id, // e.g., 103368
      trainId: train.trainDirDay?.trainId, // e.g., "T01-13UP-3"
      startTrainDate: train.trainDirDay?.startTrainDate
    }));

    return trainIds;
  } catch (error) {
    if (attempt < CONFIG.maxRetries) {
      const delay = Math.min(
        CONFIG.initialRetryDelay * Math.pow(2, attempt - 1),
        CONFIG.maxRetryDelay
      );
      console.log(`⏳ Retry ${attempt}/${CONFIG.maxRetries} for ${route.TrainName}`);
      await sleep(delay);
      return fetchTrainIdsForRoute(route, attempt + 1);
    }

    console.error(`❌ Failed to fetch train IDs for ${route.TrainName}: ${error.message}`);
    return [];
  }
}

/**
 * Step 2: Fetch detailed schedule for a specific train ID
 */
async function fetchTrainSchedule(trainDirDayId, trainCode, attempt = 1) {
  try {
    await sleep(CONFIG.delayBetweenRequests);

    const response = await axios.get(
      `${API_BASE_URL}/trainInfo/stopTimeTable/${trainDirDayId}`,
      { timeout: CONFIG.requestTimeout }
    );

    if (response.data.code !== 200) {
      throw new Error(`API returned code: ${response.data.code}`);
    }

    // Extract station-by-station schedule
    // Handle new API format where station info is nested in station object
    const stations = (response.data.data || []).map(station => {
      const stationInfo = station.station || {};
      // Store both simplified format (for compatibility) and full station object (for boardTime)
      return {
        // Simplified format for backward compatibility
        StationName: stationInfo.stationNameEn || stationInfo.stationName || station.stationName || '',
        StationId: stationInfo.stationCode || station.stationCode || '',
        stationCode: stationInfo.stationCode || station.stationCode || '',
        DepartureTime: station.boardTime || station.departureTime || '',
        ArrivalTime: station.arrivalTime || '',
        Distance: parseFloat(station.distance || 0),
        stopTime: parseInt(station.stopTime || 0),
        differentDay: station.differentDay === 1 || station.differentDay === true,
        // Full station object for complete API data
        boardTime: station.boardTime || '',
        arrivalTime: station.arrivalTime || '',
        distance: station.distance || 0,
        differentDay: station.differentDay || false
      };
    });

    return {
      success: true,
      trainDirDayId,
      trainCode,
      stations
    };
  } catch (error) {
    if (attempt < CONFIG.maxRetries) {
      const delay = Math.min(
        CONFIG.initialRetryDelay * Math.pow(2, attempt - 1),
        CONFIG.maxRetryDelay
      );
      console.log(`⏳ Retry ${attempt}/${CONFIG.maxRetries} for train ID ${trainDirDayId}`);
      await sleep(delay);
      return fetchTrainSchedule(trainDirDayId, trainCode, attempt + 1);
    }

    console.error(`❌ Failed to fetch schedule for train ID ${trainDirDayId}: ${error.message}`);
    return { success: false, trainDirDayId, trainCode, error: error.message };
  }
}

/**
 * Extract train number from train code (e.g., "13UP" -> 13)
 */
function extractTrainNumber(trainCode) {
  if (!trainCode) return null;
  const match = String(trainCode).match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

/**
 * Match official train with local schedule
 */
function matchTrainWithLocal(trainCode, localSchedules) {
  const trainNum = extractTrainNumber(trainCode);
  if (!trainNum) return null;

  return localSchedules.find(schedule => {
    const localTrainNum = schedule.TrainId || schedule.trainId;
    return localTrainNum === trainNum;
  });
}

/**
 * Save cache to disk
 */
async function saveCache(data) {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }

    fs.writeFileSync(CACHE_FILE, JSON.stringify({
      cachedAt: new Date().toISOString(),
      travelDate: CONFIG.travelDate,
      totalTrains: data.length,
      successfulFetches: data.filter(r => r.success).length,
      failedFetches: data.filter(r => !r.success).length,
      results: data
    }, null, 2));

    console.log(`✅ Cache saved with ${data.filter(r => r.success).length}/${data.length} successful fetches`);
  } catch (error) {
    console.error('❌ Error saving cache:', error.message);
  }
}

/**
 * Load existing cache
 */
async function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf-8');
      const cache = JSON.parse(data);

      const cacheAge = Date.now() - new Date(cache.cachedAt).getTime();
      const cacheAgeHours = (cacheAge / (1000 * 60 * 60)).toFixed(1);

      console.log(`📦 Loaded cache from ${cache.cachedAt} (${cacheAgeHours} hours old)`);
      console.log(`   - Successful: ${cache.successfulFetches}/${cache.totalTrains}`);

      return cache.results || [];
    }
  } catch (error) {
    console.error('❌ Error loading cache:', error.message);
  }
  return [];
}

/**
 * Fetch all official schedules using two-step process
 */
async function fetchAllOfficialSchedules(force = false) {
  console.log('\n' + '='.repeat(80));
  console.log('FETCHING OFFICIAL TRAIN SCHEDULES (Two-Step Process)');
  console.log('='.repeat(80));
  console.log(`Travel Date: ${CONFIG.travelDate}`);
  console.log(`Started: ${new Date().toLocaleString()}`);

  if (!force) {
    const cache = await loadCache();
    if (cache.length > 0) {
      const cacheAge = Date.now() - new Date(cache[0].timestamp || Date.now()).getTime();
      const cacheAgeHours = (cacheAge / (1000 * 60 * 60)).toFixed(1);

      if (cacheAgeHours < 6) {
        console.log(`✅ Using cached schedules (${cacheAgeHours} hours old)`);
        return cache;
      }
    }
  }

  // Load data
  console.log('\n📥 Loading train summary and local schedules...');
  const trainsSummary = await loadTrainsSummary();
  const localSchedules = await loadLocalSchedules();

  // Filter routes with valid station codes
  const routesWithCodes = trainsSummary.filter(train =>
    train.StartStationCode && train.StartStationCode !== 'NOT_FOUND' &&
    train.EndStationCode && train.EndStationCode !== 'NOT_FOUND'
  );

  console.log(`✅ Found ${routesWithCodes.length}/${trainsSummary.length} routes with valid station codes`);
  console.log(`✅ Loaded ${localSchedules.length} local schedules`);

  // STEP 1: Fetch train IDs for all routes
  console.log(`\n🔄 STEP 1: Fetching train IDs for ${routesWithCodes.length} routes...`);
  const allTrainIds = [];
  let routesFetched = 0;

  for (let i = 0; i < routesWithCodes.length; i += CONFIG.batchSize) {
    const batch = routesWithCodes.slice(i, i + CONFIG.batchSize);
    console.log(`  Processing batch ${Math.floor(i / CONFIG.batchSize) + 1}/${Math.ceil(routesWithCodes.length / CONFIG.batchSize)}`);

    const batchResults = await Promise.all(
      batch.map(route => fetchTrainIdsForRoute(route))
    );

    batchResults.forEach((trainIds, idx) => {
      const route = batch[idx];
      trainIds.forEach(id => {
        allTrainIds.push({ ...id, route });
      });
      if (trainIds.length > 0) {
        console.log(`  ✅ ${route.TrainName}: ${trainIds.length} train(s) found`);
      }
    });

    routesFetched += batch.length;
  }

  console.log(`\n✅ Step 1 complete: Found ${allTrainIds.length} total trains`);

  // STEP 2: Fetch detailed schedules for each train ID
  console.log(`\n🔄 STEP 2: Fetching detailed schedules for ${allTrainIds.length} trains...`);
  const results = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < allTrainIds.length; i += CONFIG.batchSize) {
    const batch = allTrainIds.slice(i, i + CONFIG.batchSize);
    const batchNumber = Math.floor(i / CONFIG.batchSize) + 1;
    const totalBatches = Math.ceil(allTrainIds.length / CONFIG.batchSize);

    console.log(`  Batch ${batchNumber}/${totalBatches}`);

    const batchResults = await Promise.all(
      batch.map(train => fetchTrainSchedule(train.trainDirDayId, train.trainCode))
    );

    batchResults.forEach((result, idx) => {
      const trainData = batch[idx];
      const route = trainData.route;

      if (result.success) {
        // Try to match with local schedule
        const localMatch = matchTrainWithLocal(result.trainCode, localSchedules);
        successCount++;

        results.push({
          ...result,
          route,
          localMatch: localMatch ? localMatch.TrainId || localMatch.trainId : null,
          timestamp: new Date().toISOString()
        });

        const matchStatus = localMatch ? '✅ matched' : '⚠️ no match';
        console.log(`    ✅ ${result.trainCode} (${trainData.trainDirDayId}): ${result.stations.length} stations ${matchStatus}`);
      } else {
        failureCount++;
        results.push(result);
        console.log(`    ❌ ${result.trainCode}: ${result.error}`);
      }
    });
  }

  // Save cache
  console.log('\n💾 Saving results to cache...');
  await saveCache(results);

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 FINAL SUMMARY:');
  console.log(`   - Routes searched: ${routesWithCodes.length}`);
  console.log(`   - Total trains found: ${allTrainIds.length}`);
  console.log(`   - Successful schedule fetches: ${successCount}`);
  console.log(`   - Failed schedule fetches: ${failureCount}`);
  console.log(`   - Success rate: ${((successCount / allTrainIds.length) * 100).toFixed(1)}%`);
  console.log('='.repeat(80) + '\n');

  return results;
}

/**
 * Get latest schedules (from cache or fresh fetch)
 */
async function getLatestSchedules(force = false) {
  return await fetchAllOfficialSchedules(force);
}

/**
 * Check cache freshness
 */
async function getCacheFreshness() {
  try {
    if (!fs.existsSync(CACHE_FILE)) {
      return {
        hasCachedData: false,
        cacheAge: null,
        cacheCreatedAt: null
      };
    }

    const data = fs.readFileSync(CACHE_FILE, 'utf-8');
    const cache = JSON.parse(data);
    const cacheAge = Date.now() - new Date(cache.cachedAt).getTime();
    const cacheAgeHours = (cacheAge / (1000 * 60 * 60)).toFixed(1);

    return {
      hasCachedData: true,
      cacheAge: cacheAgeHours,
      cacheCreatedAt: cache.cachedAt,
      travelDate: cache.travelDate,
      successfulFetches: cache.successfulFetches,
      failedFetches: cache.failedFetches,
      totalTrains: cache.totalTrains
    };
  } catch (error) {
    return {
      hasCachedData: false,
      error: error.message
    };
  }
}

/**
 * Generate schedules-from-api.json from local schedules with trainCode
 * Uses local schedules as source of truth, enriched with trainCode from API cache
 */
async function generateSchedulesFromCache() {
  try {
    const API_OUTPUT_FILE = path.join(CACHE_DIR, 'schedules-from-api.json');

    console.log('\n' + '='.repeat(80));
    console.log('GENERATING schedules-from-api.json FROM LOCAL SCHEDULES');
    console.log('='.repeat(80));

    // Load local schedules (source of truth with trainCode)
    console.log('\n📥 Loading local schedules...');
    const localSchedules = await loadLocalSchedules();
    if (localSchedules.length === 0) {
      console.log('⚠️  No local schedules found');
      return { success: false, message: 'No local schedules' };
    }
    console.log(`✅ Loaded ${localSchedules.length} local schedules`);

    // Create map from local schedules for coordinates
    console.log('\n📥 Creating local schedules map...');
    const localMap = new Map();
    localSchedules.forEach(s => {
      const trainNum = s.TrainId || s.trainId;
      if (trainNum) localMap.set(trainNum, s);
    });
    console.log(`✅ Created map with ${localMap.size} local schedules`);

    // Convert cache to schedules format
    console.log('\n🔄 Converting cache to schedules format...');
    const convertedSchedules = [];
    let processed = 0;

    cacheData.forEach((cacheEntry, idx) => {
      if (!cacheEntry.success) return;

      try {
        const trainCode = cacheEntry.trainCode;
        const trainNumber = extractTrainNumber(trainCode);
        const trainName = `Train ${trainCode}`;

        // Get local schedule if available
        const localSchedule = localMap.get(trainNumber);

        // Convert stations
        const stations = (cacheEntry.stations || []).map((station, stationIdx) => {
          const localStation = localSchedule?.stations?.[stationIdx];

          // Normalize time format to HH:MM:SS
          const normalizeTime = (timeStr) => {
            if (!timeStr) return '';
            if (/^\d{2}:\d{2}:\d{2}$/.test(timeStr)) return timeStr;
            const match = timeStr.match(/T(\d{2}):(\d{2}):(\d{2})/);
            if (match) return `${match[1]}:${match[2]}:${match[3]}`;
            return timeStr;
          };

          // Prefer cache data, fallback to local schedule
          const cacheDepTime = station.DepartureTime || station.boardTime;
          const cacheArrTime = station.ArrivalTime || station.arrivalTime;

          const departureTime = normalizeTime(cacheDepTime || localStation?.DepartureTime || '');
          const arrivalTime = normalizeTime(cacheArrTime || localStation?.ArrivalTime || '');

          return {
            StationName: localStation?.StationName || '',
            StationId: localStation?.StationId || station.stationCode || '',
            stationCode: localStation?.stationCode || station.stationCode || '',
            TrainNumber: trainNumber,
            TrainName: trainName,
            TrainId: trainNumber,
            DepartureTime: departureTime,
            ArrivalTime: arrivalTime,
            Distance: parseFloat(station.Distance || station.distance || 0),
            stopTime: parseInt(station.stopTime || 0),
            IsDayChanged: station.differentDay || false,
            DayCount: station.differentDay ? 1 : 0,
            IsUp: trainCode.includes('UP'),
            OrderNumber: stationIdx + 1,
            Latitude: localStation?.Latitude || 0,
            Longitude: localStation?.Longitude || 0
          };
        });

        if (stations.length > 0) {
          convertedSchedules.push({
            TrainId: trainNumber,
            TrainNumber: trainNumber,
            trainId: trainNumber,
            trainName: trainName,
            TrainName: trainName,
            TrainCode: trainCode,
            stations: stations,
            stationCount: stations.length,
            sourceType: 'api_response',
            trainDirDayId: cacheEntry.trainDirDayId,
            fetchedAt: cacheEntry.timestamp || new Date().toISOString()
          });
          processed++;
        }
      } catch (error) {
        console.error(`  ❌ Error processing train ${idx}:`, error.message);
      }

      if ((idx + 1) % 50 === 0) {
        console.log(`  ⏳ Processed ${idx + 1}/${cacheData.length}...`);
      }
    });

    // Save schedules
    console.log(`\n💾 Saving to ${path.basename(API_OUTPUT_FILE)}...`);
    fs.writeFileSync(API_OUTPUT_FILE, JSON.stringify(convertedSchedules, null, 2));
    console.log(`✅ Saved ${convertedSchedules.length} trains`);

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 GENERATION SUMMARY:');
    console.log(`   - Total cache entries: ${cacheData.length}`);
    console.log(`   - Successfully converted: ${processed}`);
    console.log(`   - Total stations: ${convertedSchedules.reduce((sum, t) => sum + t.stationCount, 0)}`);
    console.log('='.repeat(80) + '\n');

    return { success: true, trainsGenerated: processed, file: API_OUTPUT_FILE };
  } catch (error) {
    console.error('❌ Error generating schedules:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  fetchAllOfficialSchedules,
  getLatestSchedules,
  getCacheFreshness,
  loadCache,
  saveCache,
  loadTrainsSummary,
  loadLocalSchedules,
  extractTrainNumber,
  matchTrainWithLocal,
  generateSchedulesFromCache,
  CONFIG
};
