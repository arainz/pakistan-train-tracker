const fs = require('fs');
const path = require('path');

// Load data
const schedulesPath = path.join(__dirname, 'public/data/schedules.json');
const apiRawPath = path.join(__dirname, 'public/data/api-raw-data.json');

const schedules = JSON.parse(fs.readFileSync(schedulesPath, 'utf8'));
const apiRawData = JSON.parse(fs.readFileSync(apiRawPath, 'utf8'));

// Build a map of trainCode -> stationCode -> API data for quick lookup
const apiDataMap = {};
for (const trainData of apiRawData) {
  const trainCode = trainData.stations[0]?.stationTrainCode;

  if (!trainCode) continue;

  if (!apiDataMap[trainCode]) {
    apiDataMap[trainCode] = {};
  }

  // Map each station by its code
  for (const station of trainData.stations) {
    const stationCode = station.station.stationCode;

    // Store all occurrences (in case of duplicate codes, keep the first one)
    if (!apiDataMap[trainCode][stationCode]) {
      apiDataMap[trainCode][stationCode] = station;
    }
  }
}

console.log(`Mapped ${Object.keys(apiDataMap).length} train codes in API data`);

// Get set of trainCodes that have API data
const trainCodesInApi = new Set(Object.keys(apiDataMap));

// Build a map of trainCode to schedule train data, using only those with API data
const trainCodeToSchedule = {};
for (const train of schedules) {
  if (!train.trainCode || !train.stations || train.stations.length === 0) continue;

  // Only keep trains that have API data
  if (trainCodesInApi.has(train.trainCode)) {
    // For duplicate trainCodes, we use the one that exists in API
    // We'll keep only one per trainCode (the first one we encounter)
    if (!trainCodeToSchedule[train.trainCode]) {
      trainCodeToSchedule[train.trainCode] = {
        schedule: train,
        trainId: train.TrainId
      };
    }
  }
}

console.log(`Mapped ${Object.keys(trainCodeToSchedule).length} schedule trains with API data`);

// Function to parse time string and extract HH:MM:SS (normalize to include seconds)
function extractTimeHMS(timeStr) {
  if (!timeStr) return null;

  // Handle ISO format like "2015-01-01T22:15:00.000+05:00"
  if (timeStr.includes('T')) {
    const match = timeStr.match(/T(\d{2}):(\d{2}):(\d{2})/);
    if (match) {
      return `${match[1]}:${match[2]}:${match[3]}`;
    }
  }

  // Handle plain HH:MM:SS format
  if (/^\d{2}:\d{2}:\d{2}$/.test(timeStr)) {
    return timeStr;
  }

  // Handle HH:MM format (without seconds) - add :00
  if (/^\d{2}:\d{2}$/.test(timeStr)) {
    return `${timeStr}:00`;
  }

  return null;
}

// Function to check if times match
function timesMatch(schedTime, apiTime) {
  const schedHMS = extractTimeHMS(schedTime);
  const apiHMS = extractTimeHMS(apiTime);

  if (!schedHMS || !apiHMS) return 'NO'; // Missing time data

  return schedHMS === apiHMS ? 'YES' : 'NO';
}

// Generate report
const reportRows = [];
reportRows.push([
  'TRAIN_CODE',
  'STATION_CODE',
  'SCHEDULE_ARRIVAL_TIME',
  'SCHEDULE_DEPARTURE_TIME',
  'API_ARRIVAL_TIME',
  'API_DEPARTURE_TIME',
  'TIME_MATCH'
]);

let matchedCount = 0;
let unmatchedCount = 0;

for (const trainCode in trainCodeToSchedule) {
  const { schedule } = trainCodeToSchedule[trainCode];

  // Get API data for this train
  const apiStations = apiDataMap[trainCode];

  if (!apiStations) {
    // This shouldn't happen since we filtered to only trains with API data
    continue;
  }

  // Match stations within this train
  for (const station of schedule.stations) {
    if (!station.stationCode) continue; // Skip stations without codes

    const stationCode = station.stationCode;
    const apiStation = apiStations[stationCode];

    if (apiStation) {
      // Found matching API station
      const schedArrival = station.ArrivalTime || '';
      const schedDeparture = station.DepartureTime || '';
      const apiArrival = apiStation.arrivalTime || '';
      const apiBoardTime = apiStation.boardTime || '';

      // Format API times to HH:MM:SS
      const formattedApiArrival = extractTimeHMS(apiArrival);
      const formattedApiBoardTime = extractTimeHMS(apiBoardTime);

      const timeMatch = timesMatch(
        schedDeparture || schedArrival,
        apiBoardTime || apiArrival
      );

      reportRows.push([
        trainCode,
        stationCode,
        schedArrival,
        schedDeparture,
        formattedApiArrival || '',
        formattedApiBoardTime || '',
        timeMatch
      ]);

      if (timeMatch === 'YES') {
        matchedCount++;
      } else {
        unmatchedCount++;
      }
    } else {
      // No matching API station for this code
      reportRows.push([
        trainCode,
        stationCode,
        station.ArrivalTime || '',
        station.DepartureTime || '',
        '',
        '',
        'NO'
      ]);
      unmatchedCount++;
    }
  }
}

// Write CSV
function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const csvContent = reportRows
  .map(row => row.map(escapeCSV).join(','))
  .join('\n');

const outputPath = path.join(__dirname, 'public/data/schedule-train-station-times-match.csv');
fs.writeFileSync(outputPath, csvContent, 'utf8');

console.log(`\nReport generated: ${outputPath}`);
console.log(`Total rows: ${reportRows.length - 1}`);
console.log(`Matched times: ${matchedCount}`);
console.log(`Unmatched/No API data: ${unmatchedCount}`);
