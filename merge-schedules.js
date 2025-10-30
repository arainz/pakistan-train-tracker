#!/usr/bin/env node

/**
 * Merge old and new schedule data:
 * - Keep ALL old trains/schedules
 * - Update departure/arrival times from new official API where available
 * - Add Distance field from new data
 * - Note station count differences
 */

const fs = require('fs');
const path = require('path');

const OLD_DIR = '/tmp/merge_data';
const NEW_DIR = '/tmp/merge_data';
const OUTPUT_DIR = path.join(__dirname, 'public', 'data');

console.log('🔄 Merging OLD and NEW schedule data...\n');

// Load OLD data
console.log('📥 Loading OLD data...');
const oldSchedulesRaw = JSON.parse(fs.readFileSync(path.join(OLD_DIR, 'old_schedules.json'), 'utf-8'));
const oldSchedules = { Response: Array.isArray(oldSchedulesRaw) ? oldSchedulesRaw : oldSchedulesRaw.Response };
console.log(`  OLD schedules: ${oldSchedules.Response.length}`);

// Load NEW data
console.log('\n📥 Loading NEW data from Pakistan Railways API...');
const newSchedules = JSON.parse(fs.readFileSync(path.join(NEW_DIR, 'new_schedules.json'), 'utf-8'));
console.log(`  NEW schedules: ${newSchedules.Response.length}`);

// Extract train number helper (e.g., "13UP" -> 13, "13" -> 13)
const extractTrainNumber = (identifier) => {
  const match = String(identifier).match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
};

// Create map of new schedules by train number
const newSchedulesByNumber = new Map();
newSchedules.Response.forEach(newSchedule => {
  const trainNum = extractTrainNumber(newSchedule.TrainCode);
  if (trainNum) {
    // Handle duplicates: keep the one with more stations
    const existing = newSchedulesByNumber.get(trainNum);
    if (!existing || newSchedule.stations.length > existing.stations.length) {
      newSchedulesByNumber.set(trainNum, newSchedule);
    }
  }
});

console.log(`\n✅ Deduplicated NEW schedules: ${newSchedulesByNumber.size}`);
console.log('\n📝 Merging schedules...\n');

let updatedCount = 0;
let stationCountDifferences = [];

// Keep ALL old schedules, update times/distances where new data available
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
    
    // Match stations by name or sequence
    const updatedStations = oldSchedule.stations.map((oldStation, index) => {
      const newStation = newSchedule.stations[index]; // Match by sequence for now
      
      if (newStation) {
        return {
          ...oldStation,  // Keep ALL old fields
          // Only update if new data has valid values
          DepartureTime: (newStation.DepartureTime && newStation.DepartureTime !== '') ? newStation.DepartureTime : oldStation.DepartureTime,
          ArrivalTime: (newStation.ArrivalTime && newStation.ArrivalTime !== null) ? newStation.ArrivalTime : oldStation.ArrivalTime,
          Distance: (newStation.Distance != null && newStation.Distance > 0) ? newStation.Distance : (oldStation.Distance || 0)
        };
      }
      return oldStation;
    });
    
    console.log(`✅ Train ${oldTrainNum}: Updated ${updatedStations.length} stations (old: ${oldStationCount}, new: ${newStationCount})`);
    
    return {
      ...oldSchedule,  // Keep ALL old schedule fields
      stations: updatedStations
    };
  }
  
  return oldSchedule;  // No new data, keep as-is
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

console.log('\n🎉 DONE! Schedules merged successfully!');
console.log('\n📌 Summary:');
console.log(`   - Total schedules: ${mergedSchedules.length}`);
console.log(`   - Updated from API: ${updatedCount}`);
console.log(`   - Kept unchanged: ${mergedSchedules.length - updatedCount}`);
console.log(`   - Station count differences: ${stationCountDifferences.length}`);

