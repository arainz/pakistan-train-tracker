#!/usr/bin/env node

/**
 * Railway Distance Data Enrichment Script
 *
 * This script fills in missing distance data in schedules.json using OSRM Railway Routing.
 * It's designed as a build-time utility to pre-populate accurate railway distances.
 *
 * Usage: node scripts/enrich-distances.js
 *
 * What it does:
 * 1. Reads schedules.json
 * 2. Identifies trains with missing distance data
 * 3. For each train, calls OSRM Railway API to calculate distances
 * 4. Computes cumulative distances from origin
 * 5. Updates schedules.json with the enriched data
 * 6. Backs up original file
 */

const fs = require('fs');
const path = require('path');

// Configuration
const SCHEDULES_FILE = './public/data/schedules.json';
const BACKUP_DIR = './backups';
const OSRM_API = 'https://router.project-osrm.org/route/v1/rail';
const CACHE_FILE = './.osrm-distance-cache.json';
const BATCH_DELAY = 100; // ms between API calls to avoid rate limiting
const TIMEOUT = 10000; // 10 seconds per request

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, prefix, message) {
  console.log(`${colors[color]}${prefix}${colors.reset} ${message}`);
}

/**
 * Fetch data from OSRM API with timeout and error handling
 * Supports both individual and batch requests
 */
async function fetchOSRMRoute(lat1, lon1, lat2, lon2) {
  const url = `${OSRM_API}/${lon1},${lat1};${lon2},${lat2}?overview=false`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      return data.routes[0].distance / 1000; // Convert meters to km
    } else {
      throw new Error(`No route found: ${data.code}`);
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timeout (10s)');
    }
    throw error;
  }
}

/**
 * Fetch batch OSRM route (3-25 waypoints per request - faster!)
 * Returns array of distances for each leg
 */
async function fetchOSRMBatchRoute(coordinates) {
  // Build waypoint string: lon1,lat1;lon2,lat2;lon3,lat3;...
  const waypoints = coordinates.map(([lat, lon]) => `${lon},${lat}`).join(';');
  const url = `${OSRM_API}/${waypoints}?overview=false`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      // Extract distances from each leg
      if (route.legs && route.legs.length > 0) {
        return route.legs.map(leg => leg.distance / 1000); // Convert to km
      } else {
        throw new Error('No route legs found');
      }
    } else {
      throw new Error(`No route found: ${data.code}`);
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timeout (10s)');
    }
    throw error;
  }
}

/**
 * Load or initialize distance cache
 */
function loadCache() {
  if (fs.existsSync(CACHE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    } catch (e) {
      log('yellow', '⚠️', 'Failed to load cache, starting fresh');
      return {};
    }
  }
  return {};
}

/**
 * Save distance cache
 */
function saveCache(cache) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

/**
 * Get cached distance or fetch from OSRM
 */
async function getDistance(lat1, lon1, lat2, lon2, cache) {
  const key = `${lat1.toFixed(4)}_${lon1.toFixed(4)}_${lat2.toFixed(4)}_${lon2.toFixed(4)}`;

  if (cache[key]) {
    return { distance: cache[key], cached: true };
  }

  try {
    const distance = await fetchOSRMRoute(lat1, lon1, lat2, lon2);
    cache[key] = distance;
    return { distance, cached: false };
  } catch (error) {
    return { distance: null, error: error.message };
  }
}

/**
 * Main enrichment logic
 */
async function enrichDistances() {
  log('cyan', '📚', 'Loading schedules.json...');

  if (!fs.existsSync(SCHEDULES_FILE)) {
    log('red', '❌', `File not found: ${SCHEDULES_FILE}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(SCHEDULES_FILE, 'utf-8'));
  const cache = loadCache();

  let totalTrains = 0;
  let trainsNeedingEnrichment = 0;
  let successfulEnrichments = 0;
  let failedEnrichments = 0;
  let totalDistancesFetched = 0;
  let totalDistancesCached = 0;

  // First pass: identify trains needing enrichment
  const trainsToEnrich = [];

  for (const trainCode in data) {
    const train = data[trainCode];
    totalTrains++;

    if (!train.stations || train.stations.length < 2) continue;

    // Check if train has missing distance data
    let hasCompleteData = true;
    for (let i = 1; i < train.stations.length; i++) {
      const station = train.stations[i];
      if (station.Distance === undefined || station.Distance === null || isNaN(station.Distance)) {
        hasCompleteData = false;
        break;
      }
    }

    if (!hasCompleteData) {
      trainsToEnrich.push(trainCode);
      trainsNeedingEnrichment++;
    }
  }

  log('blue', '📊', `Total trains: ${totalTrains}`);
  log('blue', '📊', `Trains needing enrichment: ${trainsNeedingEnrichment}`);
  log('blue', '📊', `Trains with complete data: ${totalTrains - trainsNeedingEnrichment}\n`);

  if (trainsToEnrich.length === 0) {
    log('green', '✅', 'All trains already have complete distance data!');
    return;
  }

  // Second pass: enrich distances
  log('cyan', '🚂', 'Starting distance enrichment...\n');

  for (let idx = 0; idx < trainsToEnrich.length; idx++) {
    const trainCode = trainsToEnrich[idx];
    const train = data[trainCode];

    const progress = `[${idx + 1}/${trainsToEnrich.length}]`;
    log('blue', progress, `Processing ${trainCode} (${train.stations.length} stations)...`);

    try {
      let cumulativeDistance = 0;
      train.stations[0].Distance = 0; // Origin is always 0

      // Use batch processing for faster enrichment
      // Process train in chunks (up to 15 stations per batch request)
      const BATCH_SIZE = 15;

      for (let batchStart = 1; batchStart < train.stations.length; batchStart += BATCH_SIZE - 1) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, train.stations.length);
        const batchStations = train.stations.slice(batchStart - 1, batchEnd);

        // Check if all stations in batch already have valid distances
        let needsFetching = false;
        for (const station of batchStations) {
          if (station.Distance === undefined || station.Distance === null || isNaN(station.Distance)) {
            needsFetching = true;
            break;
          }
        }

        if (!needsFetching) {
          // All stations in this batch already have distances, update cumulative
          cumulativeDistance = batchStations[batchStations.length - 1].Distance;
          continue;
        }

        // Check if all have coordinates
        let allHaveCoords = true;
        for (const station of batchStations) {
          if (!station.Latitude || !station.Longitude) {
            allHaveCoords = false;
            break;
          }
        }

        if (!allHaveCoords) {
          // Process individually if any missing coordinates
          for (let i = batchStart; i < batchEnd; i++) {
            const prevStation = train.stations[i - 1];
            const currentStation = train.stations[i];

            if (!prevStation.Latitude || !prevStation.Longitude || !currentStation.Latitude || !currentStation.Longitude) {
              log('yellow', progress, `  ⚠️ Missing coordinates for ${prevStation.StationName} → ${currentStation.StationName}`);
              currentStation.Distance = null;
              continue;
            }

            const result = await getDistance(
              prevStation.Latitude, prevStation.Longitude,
              currentStation.Latitude, currentStation.Longitude,
              cache
            );

            if (result.distance !== null) {
              cumulativeDistance += result.distance;
              currentStation.Distance = Math.round(cumulativeDistance * 10) / 10;
              if (result.cached) totalDistancesCached++;
              else totalDistancesFetched++;
            } else {
              currentStation.Distance = null;
            }
          }
          continue;
        }

        // Try batch request for this chunk
        try {
          const coordinates = batchStations.map(s => [s.Latitude, s.Longitude]);
          const distances = await fetchOSRMBatchRoute(coordinates);

          // Apply distances
          for (let j = 0; j < distances.length; j++) {
            cumulativeDistance += distances[j];
            batchStations[j + 1].Distance = Math.round(cumulativeDistance * 10) / 10;
            totalDistancesFetched++;
          }
        } catch (batchError) {
          // Fall back to individual requests if batch fails
          for (let i = batchStart; i < batchEnd; i++) {
            const prevStation = train.stations[i - 1];
            const currentStation = train.stations[i];

            const result = await getDistance(
              prevStation.Latitude, prevStation.Longitude,
              currentStation.Latitude, currentStation.Longitude,
              cache
            );

            if (result.distance !== null) {
              cumulativeDistance += result.distance;
              currentStation.Distance = Math.round(cumulativeDistance * 10) / 10;
              if (result.cached) totalDistancesCached++;
              else totalDistancesFetched++;
            } else {
              currentStation.Distance = null;
            }
          }
        }

        // Add delay between batch requests
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }

      successfulEnrichments++;

      // Log result summary
      const validDistances = train.stations.filter(s => s.Distance !== null && s.Distance !== undefined).length;
      log('green', progress, `  ✅ Enriched ${validDistances}/${train.stations.length} stations`);

    } catch (error) {
      failedEnrichments++;
      log('red', progress, `  ❌ Error: ${error.message}`);
    }
  }

  // Save enriched data
  log('cyan', '\n💾', 'Saving enriched schedules.json...');

  // Create backup
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `schedules-backup-${timestamp}.json`);

  const originalData = JSON.parse(fs.readFileSync(SCHEDULES_FILE, 'utf-8'));
  fs.writeFileSync(backupFile, JSON.stringify(originalData, null, 2));
  log('blue', '💾', `Backup saved: ${backupFile}`);

  // Save enriched data
  fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(data, null, 2));
  log('green', '✅', 'schedules.json updated successfully');

  // Save cache for future runs
  saveCache(cache);

  // Summary
  log('cyan', '\n📈', 'Enrichment Summary:');
  log('blue', '📊', `  Trains successfully enriched: ${successfulEnrichments}`);
  log('blue', '📊', `  Trains failed: ${failedEnrichments}`);
  log('blue', '📊', `  Total OSRM API calls: ${totalDistancesFetched}`);
  log('blue', '📊', `  Total cache hits: ${totalDistancesCached}`);
  log('green', '✅', `Complete! ${successfulEnrichments} trains now have accurate railway distance data.`);
}

// Run enrichment
enrichDistances().catch(error => {
  log('red', '❌', `Fatal error: ${error.message}`);
  process.exit(1);
});
