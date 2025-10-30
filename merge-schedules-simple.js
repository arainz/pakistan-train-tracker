#!/usr/bin/env node

/**
 * Simple merge: Keep OLD JSON structure exactly as-is
 * Only update VALUES of existing fields:
 * - Update DepartureTime/ArrivalTime values
 * - Add Distance value (or update if exists)
 * - Keep ALL old keys exactly the same
 */

const fs = require('fs');
const path = require('path');

const OLD_DIR = '/tmp/merge_data';
const NEW_DIR = '/tmp/merge_data';
const OUTPUT_DIR = path.join(__dirname, 'public', 'data');

console.log('🔄 Updating schedule VALUES (keeping OLD structure)...\n');

// Load OLD data - this is our base structure
console.log('📥 Loading OLD data (base structure)...');
const oldSchedulesRaw = JSON.parse(fs.readFileSync(path.join(OLD_DIR, 'old_schedules.json'), 'utf-8'));
const oldSchedules = { Response: Array.isArray(oldSchedulesRaw) ? oldSchedulesRaw : oldSchedulesRaw.Response };
console.log(`  OLD schedules: ${oldSchedules.Response.length}`);

// Load NEW data - just for updated values
console.log('\n📥 Loading NEW data (for updated values)...');
const newSchedules = JSON.parse(fs.readFileSync(path.join(NEW_DIR, 'new_schedules.json'), 'utf-8'));
console.log(`  NEW schedules: ${newSchedules.Response.length}`);

// Extract train number helper
const extractTrainNumber = (identifier) => {
  const match = String(identifier).match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
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
console.log('\n📝 Updating VALUES in old structure...\n');

let updatedCount = 0;
let stationCountDifferences = [];

// Keep OLD structure, only update VALUES
const mergedSchedules = oldSchedules.Response.map(oldSchedule => {
  const oldTrainNum = extractTrainNumber(oldSchedule.TrainId || oldSchedule.trainId || oldSchedule.TrainNumber);
  const newSchedule = oldTrainNum ? newSchedulesByNumber.get(oldTrainNum) : null;
  
  if (newSchedule) {
    updatedCount++;
    
    const oldStationCount = oldSchedule.stations ? oldSchedule.stations.length : 0;
    const newStationCount = newSchedule.stations.length;
    
    // Note if station counts differ
    if (oldStationCount !== newStationCount) {
      stationCountDifferences.push({
        trainId: oldTrainNum,
        trainName: oldSchedule.trainName || oldSchedule.TrainName,
        oldCount: oldStationCount,
        newCount: newStationCount,
        difference: newStationCount - oldStationCount
      });
    }
    
    // Match stations by sequence and update ONLY the values
    const updatedStations = oldSchedule.stations.map((oldStation, index) => {
      const newStation = newSchedule.stations[index];
      
      if (!newStation) {
        return oldStation; // No new data, keep old as-is
      }
      
      // Keep OLD station object structure, update ONLY values
      const updated = { ...oldStation };
      
      // Update DepartureTime if it exists in old and new has value
      if ('DepartureTime' in oldStation && newStation.DepartureTime) {
        updated.DepartureTime = newStation.DepartureTime;
      }
      
      // Update ArrivalTime if it exists in old and new has value
      // Note: New data doesn't have ArrivalTime, so keep old value
      
      // Add/Update Distance if new has value
      if (newStation.Distance != null && newStation.Distance >= 0) {
        updated.Distance = newStation.Distance;
      }
      
      return updated;
    });
    
    console.log(`✅ Train ${oldTrainNum}: Updated ${updatedStations.length} stations (old: ${oldStationCount}, new: ${newStationCount})`);
    
    // Return OLD schedule structure with updated station values
    return {
      ...oldSchedule,
      stations: updatedStations
    };
  }
  
  return oldSchedule;  // No new data, keep completely as-is
});

console.log(`\n✅ Updated ${updatedCount} schedules with new times/distances`);
console.log(`✅ Kept ${mergedSchedules.length - updatedCount} schedules unchanged (no new data)`);

// Report station count differences
if (stationCountDifferences.length > 0) {
  console.log(`\n📊 STATION COUNT DIFFERENCES (${stationCountDifferences.length} trains):\n`);
  stationCountDifferences.forEach(diff => {
    const sign = diff.difference > 0 ? '+' : '';
    console.log(`  Train ${diff.trainId} (${diff.trainName}): ${diff.oldCount} → ${diff.newCount} (${sign}${diff.difference})`);
  });
} else {
  console.log('\n✅ No station count differences found');
}

// Write merged data
console.log('\n💾 Saving merged schedules...');
fs.writeFileSync(
  path.join(OUTPUT_DIR, 'schedules.json'),
  JSON.stringify({ Response: mergedSchedules }, null, 2)
);
console.log(`✅ Saved ${mergedSchedules.length} schedules to public/data/schedules.json`);

// Write station count differences report
if (stationCountDifferences.length > 0) {
  fs.writeFileSync(
    path.join(__dirname, 'STATION_COUNT_DIFFERENCES.md'),
    `# Station Count Differences Report\n\n` +
    `Generated: ${new Date().toISOString()}\n\n` +
    `## Summary\n\n` +
    `Total trains with differences: **${stationCountDifferences.length}**\n\n` +
    `## Details\n\n` +
    `| Train ID | Train Name | Old Count | New Count | Difference |\n` +
    `|----------|-----------|-----------|-----------|------------|\n` +
    stationCountDifferences.map(diff => 
      `| ${diff.trainId} | ${diff.trainName} | ${diff.oldCount} | ${diff.newCount} | ${diff.difference > 0 ? '+' : ''}${diff.difference} |`
    ).join('\n') +
    `\n`
  );
  console.log(`\n📄 Saved station count differences to STATION_COUNT_DIFFERENCES.md`);
}

console.log('\n🎉 DONE! Schedule VALUES updated (structure preserved)!');
console.log('\n📌 Summary:');
console.log(`   - Total schedules: ${mergedSchedules.length}`);
console.log(`   - Updated from API: ${updatedCount}`);
console.log(`   - Kept unchanged: ${mergedSchedules.length - updatedCount}`);
console.log(`   - Station count differences: ${stationCountDifferences.length}`);
console.log('\n📌 What was updated:');
console.log(`   - DepartureTime values (where available in new data)`);
console.log(`   - Distance values added/updated`);
console.log(`   - ALL original keys preserved`);



