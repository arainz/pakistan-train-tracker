#!/usr/bin/env node

/**
 * Simple merge: Keep ALL old data, only update DepartureTime/ArrivalTime and add Distance field
 */

const fs = require('fs');
const path = require('path');

const OLD_DIR = '/tmp/old_data';
const NEW_DIR = path.join(__dirname, 'public', 'data');
const OUTPUT_DIR = path.join(__dirname, 'public', 'data');

console.log('🔄 Updating schedule times and adding distance field...\n');

// Load OLD data (this is what we keep)
console.log('📥 Loading OLD data (current production)...');
const oldSchedulesRaw = JSON.parse(fs.readFileSync(path.join(OLD_DIR, 'old_schedules.json'), 'utf-8'));
const oldSchedules = { Response: oldSchedulesRaw.data || oldSchedulesRaw.Response || [] };
console.log(`  Schedules: ${oldSchedules.Response.length}`);

// Load NEW data (only for times and distances)
console.log('\n📥 Loading NEW data (Pakistan Railways API)...');
const newSchedules = JSON.parse(fs.readFileSync(path.join(NEW_DIR, 'schedules.json'), 'utf-8'));
console.log(`  Schedules: ${newSchedules.Response.length}`);

// Extract train number helper
const extractTrainNumber = (schedule) => {
    const num = schedule.TrainId || schedule.TrainCode || schedule.trainId || schedule.trainNumber;
    const match = String(num).match(/(\d+)/);
    return match ? parseInt(match[1]) : null;
};

// Create map of new schedules by train number
const newSchedulesByNumber = new Map();
newSchedules.Response.forEach(newSchedule => {
    const trainNum = extractTrainNumber(newSchedule);
    if (trainNum) {
        newSchedulesByNumber.set(trainNum, newSchedule);
    }
});

console.log('\n📝 Updating schedules...');
let updatedCount = 0;

// Keep ALL old schedules, only update times and add Distance
const updatedSchedules = oldSchedules.Response.map(oldSchedule => {
    const oldTrainNum = extractTrainNumber(oldSchedule);
    const newSchedule = oldTrainNum ? newSchedulesByNumber.get(oldTrainNum) : null;
    
    if (newSchedule && newSchedule.stations && oldSchedule.stations) {
        updatedCount++;
        
        // Update each station: keep OLD data, only update DepartureTime/ArrivalTime and add Distance
        const updatedStations = oldSchedule.stations.map((oldStation, index) => {
            const newStation = newSchedule.stations[index];
            
            if (newStation) {
                return {
                    ...oldStation,  // Keep ALL old fields
                    DepartureTime: newStation.DepartureTime || oldStation.DepartureTime,
                    ArrivalTime: newStation.ArrivalTime || oldStation.ArrivalTime,
                    Distance: newStation.Distance || oldStation.Distance || 0
                };
            }
            return oldStation;
        });
        
        return {
            ...oldSchedule,  // Keep ALL old schedule fields
            stations: updatedStations
        };
    }
    
    return oldSchedule;  // No update available, return as-is
});

console.log(`✅ Updated ${updatedCount} schedules with new times and distances`);
console.log(`✅ Kept ${updatedSchedules.length - updatedCount} schedules unchanged`);

// Write back to file
fs.writeFileSync(
    path.join(OUTPUT_DIR, 'schedules.json'),
    JSON.stringify({ Response: updatedSchedules }, null, 2)
);

console.log('\n✅ DONE! Schedules updated with:');
console.log('   - Updated departure/arrival times from official API');
console.log('   - Added Distance field for accurate ETA calculations');
console.log('   - All other fields preserved from original data');
