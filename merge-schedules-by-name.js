#!/usr/bin/env node

/**
 * Smart merge: Match stations by NAME (case-insensitive)
 * - Keep OLD station objects as-is
 * - Update DepartureTime and Distance values for matching stations
 * - Insert NEW stations at correct position based on distance/sequence
 * - Preserve all old keys and structure
 */

const fs = require('fs');
const path = require('path');

const OLD_DIR = '/tmp/merge_data';
const NEW_DIR = '/tmp/merge_data';
const OUTPUT_DIR = path.join(__dirname, 'public', 'data');

console.log('🔄 Smart merge: Matching stations by NAME...\n');

// Load stations.json for StationId and coordinate lookup
let stationsData = [];
try {
  const stationsFile = fs.readFileSync(path.join(__dirname, 'public/data/stations.json'), 'utf-8');
  const stationsJson = JSON.parse(stationsFile);
  stationsData = stationsJson.Response || stationsJson.data || stationsJson;
  console.log(`📍 Loaded ${stationsData.length} station records for coordinate lookup\n`);
} catch (err) {
  console.log('⚠️  Could not load stations.json for coordinate lookup\n');
}

// Load OLD data
console.log('📥 Loading OLD data (base structure)...');
const oldSchedulesRaw = JSON.parse(fs.readFileSync(path.join(OLD_DIR, 'old_schedules.json'), 'utf-8'));
const oldSchedules = { Response: Array.isArray(oldSchedulesRaw) ? oldSchedulesRaw : oldSchedulesRaw.Response };
console.log(`  OLD schedules: ${oldSchedules.Response.length}`);

// Load NEW data
console.log('\n📥 Loading NEW data (for updated values)...');
const newSchedules = JSON.parse(fs.readFileSync(path.join(NEW_DIR, 'new_schedules.json'), 'utf-8'));
console.log(`  NEW schedules: ${newSchedules.Response.length}`);

// Extract train number helper
const extractTrainNumber = (identifier) => {
  const match = String(identifier).match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
};

// Calculate Levenshtein distance for fuzzy matching
const levenshteinDistance = (str1, str2) => {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j - 1] + 1, // substitution
          dp[i - 1][j] + 1,     // deletion
          dp[i][j - 1] + 1      // insertion
        );
      }
    }
  }
  return dp[m][n];
};

// Calculate similarity ratio (0-1, where 1 is identical)
const similarityRatio = (str1, str2) => {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(str1, str2);
  return 1 - (distance / maxLen);
};

// Normalize station name for matching
const normalizeStationName = (name) => {
  if (!name) return '';
  return name
    .toUpperCase()
    .replace(/\s+/g, '') // Remove ALL spaces
    .replace(/\./g, '')  // Remove dots
    .replace(/-/g, '')   // Remove hyphens
    .replace(/JN$/i, 'JN')
    .trim();
};

// Find best matching station using fuzzy matching
const findBestMatch = (targetName, stationMap) => {
  const normalizedTarget = normalizeStationName(targetName);
  
  // First try exact match
  if (stationMap.has(normalizedTarget)) {
    return stationMap.get(normalizedTarget);
  }
  
  // Check for base name match (e.g., "TAXILA" matches "TAXILA CANTT")
  const removeCommonSuffixes = (name) => {
    return name
      .replace(/CANTT$/i, '')
      .replace(/JN$/i, '')
      .replace(/JCT$/i, '')
      .replace(/ROAD$/i, '')
      .replace(/CITY$/i, '')
      .trim();
  };
  
  const targetBase = removeCommonSuffixes(normalizedTarget);
  
  // Try base name exact match first
  for (const [normName, station] of stationMap.entries()) {
    const stationBase = removeCommonSuffixes(normName);
    
    // If base names match exactly, it's a match
    if (targetBase === stationBase && targetBase.length >= 4) {
      console.log(`      🔗 Base name matched "${targetName}" → "${station.StationName}" (exact base)`);
      return station;
    }
    
    // If one is contained in the other and long enough, it's likely a match
    if (targetBase.length >= 5 && stationBase.length >= 5) {
      if (targetBase.includes(stationBase) || stationBase.includes(targetBase)) {
        console.log(`      🔗 Substring matched "${targetName}" → "${station.StationName}" (contained)`);
        return station;
      }
    }
  }
  
  // Try fuzzy matching with adaptive threshold
  let bestMatch = null;
  let bestScore = 0;
  
  // Shorter names need lower threshold (more lenient)
  const getThreshold = (len) => {
    if (len <= 5) return 0.70;  // 70% for very short names
    if (len <= 8) return 0.75;  // 75% for short names
    if (len <= 12) return 0.80; // 80% for medium names
    return 0.85;                 // 85% for long names
  };
  
  const threshold = getThreshold(normalizedTarget.length);
  
  for (const [normName, station] of stationMap.entries()) {
    const score = similarityRatio(normalizedTarget, normName);
    if (score >= threshold && score > bestScore) {
      bestScore = score;
      bestMatch = station;
    }
  }
  
  if (bestMatch) {
    console.log(`      🔗 Fuzzy matched "${targetName}" → "${bestMatch.StationName}" (${Math.round(bestScore * 100)}% similar)`);
  }
  
  return bestMatch;
};

// Find station details (ID, coordinates) from stations.json
const findStationDetails = (stationName) => {
  if (!stationsData.length || !stationName) return null;
  
  const normalized = normalizeStationName(stationName);
  
  // Try exact match first
  for (const station of stationsData) {
    if (normalizeStationName(station.StationName) === normalized) {
      return station;
    }
  }
  
  // Try fuzzy match (85% similarity for station lookup)
  let bestMatch = null;
  let bestScore = 0.85;
  
  for (const station of stationsData) {
    const score = similarityRatio(normalized, normalizeStationName(station.StationName));
    if (score > bestScore) {
      bestScore = score;
      bestMatch = station;
    }
  }
  
  return bestMatch;
};

// Convert station name to Title Case (matching old format)
const toTitleCase = (name) => {
  if (!name) return name;
  return name
    .toLowerCase()
    .split(' ')
    .map(word => {
      // Keep JN, JN. in uppercase
      if (word === 'jn' || word === 'jn.') return 'Jn';
      // Keep small words lowercase (optional, but keeping them title case for consistency)
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
};

// Create map of new schedules by train number
const newSchedulesByNumber = new Map();
newSchedules.Response.forEach(newSchedule => {
  const trainNum = extractTrainNumber(newSchedule.TrainCode);
  if (trainNum) {
    const existing = newSchedulesByNumber.get(trainNum);
    if (!existing || newSchedule.stations.length > existing.stations.length) {
      newSchedulesByNumber.set(trainNum, newSchedule);
    }
  }
});

console.log(`\n✅ Deduplicated NEW schedules: ${newSchedulesByNumber.size}`);
console.log('\n📝 Merging by station names...\n');

let updatedCount = 0;
let stationsAddedCount = 0;
let stationsUpdatedCount = 0;

// Keep OLD structure, match by name, insert new stations at correct position
const mergedSchedules = oldSchedules.Response.map(oldSchedule => {
  const oldTrainNum = extractTrainNumber(oldSchedule.TrainId || oldSchedule.trainId || oldSchedule.TrainNumber);
  const newSchedule = oldTrainNum ? newSchedulesByNumber.get(oldTrainNum) : null;
  
  if (!newSchedule) {
    return oldSchedule; // No new data
  }
  
  updatedCount++;
  
  // Create map of new stations by normalized name
  const newStationMap = new Map();
  newSchedule.stations.forEach(newSt => {
    const normName = normalizeStationName(newSt.StationName);
    if (normName) {
      newStationMap.set(normName, newSt);
    }
  });
  
  // Process old stations: keep all, update values where match found
  let updatedStations = oldSchedule.stations.map(oldStation => {
    const newStation = findBestMatch(oldStation.StationName, newStationMap);
    
    if (newStation) {
      // Found match - update values only
      stationsUpdatedCount++;
      const updated = { ...oldStation };
      
      // Update DepartureTime from API (official and correct)
      if ('DepartureTime' in oldStation && newStation.DepartureTime) {
        // Ensure format consistency: add :00 suffix if missing
        const newTime = newStation.DepartureTime;
        const newDepartureTime = newTime.length === 5 ? `${newTime}:00` : newTime;
        
        // Helper to parse time and handle missing :00 suffix
        const parseTimeToMinutes = (timeStr) => {
          if (!timeStr) return 0;
          const parts = timeStr.split(':');
          return parseInt(parts[0]) * 60 + parseInt(parts[1]);
        };
        
        // Check if departure time has changed
        const oldDeptMinutes = parseTimeToMinutes(oldStation.DepartureTime);
        const newDeptMinutes = parseTimeToMinutes(newDepartureTime);
        const timeDiff = Math.abs(newDeptMinutes - oldDeptMinutes);
        
        updated.DepartureTime = newDepartureTime;
        
        // If departure time changed, shift the arrival time by the same amount
        // to preserve the original stop duration
        if (timeDiff > 0 && oldStation.ArrivalTime && oldStation.OrderNumber > 1) {
          const oldArrMinutes = parseTimeToMinutes(oldStation.ArrivalTime);
          const stopDuration = oldDeptMinutes - oldArrMinutes;
          
          // Shift arrival by the same delta as departure
          const timeShift = newDeptMinutes - oldDeptMinutes;
          const newArrMinutes = oldArrMinutes + timeShift;
          
          const arrHours = Math.floor(newArrMinutes / 60) % 24;
          const arrMins = newArrMinutes % 60;
          updated.ArrivalTime = `${String(arrHours).padStart(2, '0')}:${String(arrMins).padStart(2, '0')}:00`;
        } else if (oldStation.ArrivalTime) {
          // Keep OLD ArrivalTime but ensure it has :00 suffix
          const oldArr = oldStation.ArrivalTime;
          updated.ArrivalTime = oldArr.length === 5 ? `${oldArr}:00` : oldArr;
        }
      }
      
      // ALWAYS update Distance field (this is accurate from API)
      if (newStation.Distance != null && newStation.Distance >= 0) {
        updated.Distance = newStation.Distance;
      }
      
      return updated;
    }
    
    return oldStation; // No match, keep as-is
  });
  
  // Find NEW stations that don't exist in old data (using fuzzy matching)
  const oldStationMap = new Map();
  oldSchedule.stations.forEach(s => {
    const normName = normalizeStationName(s.StationName);
    if (normName) {
      oldStationMap.set(normName, s);
    }
  });
  
  const newStationsToAdd = newSchedule.stations.filter(newSt => {
    // Use fuzzy matching to check if station already exists
    const match = findBestMatch(newSt.StationName, oldStationMap);
    return !match; // Only add if no match found
  });
  
  if (newStationsToAdd.length > 0) {
    console.log(`\n🚂 Train ${oldTrainNum}:`);
    console.log(`   📍 Found ${newStationsToAdd.length} NEW stations to insert`);
    
    newStationsToAdd.forEach(newSt => {
      stationsAddedCount++;
      
      // Find correct insertion position based on distance
      let insertIndex = updatedStations.length; // Default: append at end
      
      if (newSt.Distance != null) {
        // Find position based on distance
        for (let i = 0; i < updatedStations.length; i++) {
          const currentDist = updatedStations[i].Distance || 0;
          if (newSt.Distance < currentDist) {
            insertIndex = i;
            break;
          }
        }
      }
      
      // Create new station object matching old format
      // Use API times (they are official and correct)
      
      let arrivalTime = null;
      let departureTime = null;
      
      if (newSt.DepartureTime) {
        const newTime = newSt.DepartureTime;
        departureTime = newTime.length === 5 ? `${newTime}:00` : newTime;
        
        // Calculate arrival time (2 min before departure)
        const [hours, minutes] = departureTime.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes;
        const arrivalMinutes = totalMinutes - 2;
        const arrHours = Math.floor(arrivalMinutes / 60);
        const arrMins = arrivalMinutes % 60;
        arrivalTime = `${String(arrHours).padStart(2, '0')}:${String(arrMins).padStart(2, '0')}:00`;
      }
      
      // Try to find station details from stations.json
      const stationDetails = findStationDetails(newSt.StationName);
      
      // Determine DayCount based on surrounding stations
      const prevStation = insertIndex > 0 ? updatedStations[insertIndex - 1] : null;
      const nextStation = insertIndex < updatedStations.length ? updatedStations[insertIndex] : null;
      
      let dayCount = 0;
      let isDayChanged = false;
      
      if (prevStation && nextStation) {
        // If both prev and next have same DayCount, use that
        if (prevStation.DayCount === nextStation.DayCount) {
          dayCount = prevStation.DayCount || 0;
        } else if (prevStation.DayCount != null) {
          // Use previous station's day count
          dayCount = prevStation.DayCount;
        }
        
        // Check if day changed at next station
        if (nextStation.IsDayChanged && nextStation.DayCount > dayCount) {
          // Day changes AFTER this new station, keep current day
          isDayChanged = false;
        } else if (prevStation.IsDayChanged && prevStation.DayCount > (prevStation.DayCount - 1)) {
          // Day changed at previous station
          dayCount = prevStation.DayCount;
        }
      } else if (prevStation) {
        dayCount = prevStation.DayCount || 0;
      } else if (nextStation) {
        dayCount = nextStation.DayCount || 0;
      }
      
      const newStationObj = {
        TrainNumber: oldSchedule.TrainNumber || oldSchedule.TrainId,
        TrainName: oldSchedule.trainName || oldSchedule.TrainName,
        TrainId: oldSchedule.TrainId,
        StationId: stationDetails?.StationDetailsId || null,
        ArrivalTime: arrivalTime,
        DepartureTime: departureTime,
        IsDayChanged: isDayChanged,
        DayCount: dayCount,
        IsUp: oldSchedule.stations[0]?.IsUp || true,
        OrderNumber: insertIndex + 1,
        StationName: toTitleCase(newSt.StationName), // Convert to Title Case
        Latitude: stationDetails?.Latitude || null,
        Longitude: stationDetails?.Longitude || null,
        Distance: newSt.Distance || 0
      };
      
      // Insert at correct position
      updatedStations.splice(insertIndex, 0, newStationObj);
      
      if (stationDetails) {
        console.log(`      ➕ Inserted "${newSt.StationName}" at position ${insertIndex + 1} (${newSt.Distance} km) [ID: ${stationDetails.StationDetailsId}]`);
      } else {
        console.log(`      ➕ Inserted "${newSt.StationName}" at position ${insertIndex + 1} (${newSt.Distance} km) [⚠️  No coordinates]`);
      }
    });
    
    // Update OrderNumbers after insertions
    updatedStations = updatedStations.map((st, idx) => ({
      ...st,
      OrderNumber: idx + 1
    }));
  }
  
  console.log(`   ✅ Total: ${updatedStations.length} stations (was ${oldSchedule.stations.length})`);
  
  // Return OLD schedule structure with updated stations
  return {
    ...oldSchedule,
    stations: updatedStations
  };
});

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`✅ Updated ${updatedCount} train schedules`);
console.log(`✅ Updated ${stationsUpdatedCount} existing station values`);
console.log(`✅ Added ${stationsAddedCount} new stations`);
console.log(`✅ Kept ${mergedSchedules.length - updatedCount} schedules unchanged`);

// Write merged data
console.log('\n💾 Saving merged schedules...');
fs.writeFileSync(
  path.join(OUTPUT_DIR, 'schedules.json'),
  JSON.stringify({ Response: mergedSchedules }, null, 2)
);
console.log(`✅ Saved ${mergedSchedules.length} schedules to public/data/schedules.json`);

console.log('\n🎉 DONE! Smart merge completed!');
console.log('\n📌 What happened:');
console.log(`   ✓ Matched stations by name (case-insensitive)`);
console.log(`   ✓ Updated DepartureTime & Distance for existing stations`);
console.log(`   ✓ Inserted new stations at correct positions`);
console.log(`   ✓ Preserved ALL old station objects & structure`);

