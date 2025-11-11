const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Load required modules
const { getLatestSchedules, getCacheFreshness } = require('../services/fetchOfficialSchedules');

const PUBLIC_DATA_DIR = path.join(__dirname, '..', 'public', 'data');
const SERVER_DATA_DIR = path.join(__dirname, '..', '.server-data');

// Ensure server data directory exists
if (!fs.existsSync(SERVER_DATA_DIR)) {
  fs.mkdirSync(SERVER_DATA_DIR, { recursive: true });
}

const SCHEDULES_FILE = path.join(PUBLIC_DATA_DIR, 'schedules.json');
const API_RAW_DATA_FILE = path.join(SERVER_DATA_DIR, 'api-raw-data.json');
const REPORT_FILE = path.join(SERVER_DATA_DIR, 'schedule-train-station-times-match.csv');

/**
 * Helper: Extract HH:MM:SS from time string
 */
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

/**
 * Helper: Check if times match
 */
function timesMatch(schedTime, apiTime) {
  const schedHMS = extractTimeHMS(schedTime);
  const apiHMS = extractTimeHMS(apiTime);

  if (!schedHMS || !apiHMS) return 'NO'; // Missing time data

  return schedHMS === apiHMS ? 'YES' : 'NO';
}

/**
 * Helper: Generate the report
 */
function generateReport() {
  try {
    const schedules = JSON.parse(fs.readFileSync(SCHEDULES_FILE, 'utf8'));
    const apiRawData = JSON.parse(fs.readFileSync(API_RAW_DATA_FILE, 'utf8'));

    // Build API data map: trainCode -> stationCode -> API data
    const apiDataMap = {};
    for (const trainData of apiRawData) {
      // Handle both old format (stationTrainCode) and new format (trainCode field)
      const trainCode = trainData.trainCode || trainData.stations[0]?.stationTrainCode;
      if (!trainCode) continue;

      if (!apiDataMap[trainCode]) {
        apiDataMap[trainCode] = {};
      }

      for (const station of trainData.stations) {
        // Handle both nested format (station.stationCode) and flat format (stationCode)
        const stationCode = station.stationCode || station.station?.stationCode;
        if (!stationCode) continue;

        if (!apiDataMap[trainCode][stationCode]) {
          apiDataMap[trainCode][stationCode] = station;
        }
      }
    }

    // Get set of trainCodes that have API data
    const trainCodesInApi = new Set(Object.keys(apiDataMap));

    // Build schedule map, using only those with API data
    const trainCodeToSchedule = {};
    for (const train of schedules) {
      if (!train.trainCode || !train.stations || train.stations.length === 0) continue;

      if (trainCodesInApi.has(train.trainCode)) {
        if (!trainCodeToSchedule[train.trainCode]) {
          trainCodeToSchedule[train.trainCode] = {
            schedule: train,
            trainId: train.TrainId
          };
        }
      }
    }

    // Generate report rows
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
      const apiStations = apiDataMap[trainCode];

      if (!apiStations) continue;

      for (const station of schedule.stations) {
        if (!station.stationCode) continue;

        const stationCode = station.stationCode;
        const apiStation = apiStations[stationCode];

        if (apiStation) {
          const schedArrival = station.ArrivalTime || '';
          const schedDeparture = station.DepartureTime || '';

          // Handle both formats: lowercase (nested) and uppercase/mixed case (flat)
          const apiArrival = apiStation.arrivalTime || apiStation.ArrivalTime || '';
          const apiBoardTime = apiStation.boardTime || apiStation.DepartureTime || '';

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

    // Save CSV
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

    fs.writeFileSync(REPORT_FILE, csvContent, 'utf8');

    return {
      success: true,
      totalRows: reportRows.length - 1,
      matchedTimes: matchedCount,
      unmatchedTimes: unmatchedCount,
      matchPercentage: ((matchedCount / (matchedCount + unmatchedCount)) * 100).toFixed(1)
    };
  } catch (error) {
    console.error('Error generating report:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * GET /api/schedule-report/status
 * Get current status of data and report
 */
router.get('/status', async (req, res) => {
  try {
    const schedulesExist = fs.existsSync(SCHEDULES_FILE);
    const apiDataExist = fs.existsSync(API_RAW_DATA_FILE);
    const reportExist = fs.existsSync(REPORT_FILE);
    const cacheFreshness = await getCacheFreshness();

    res.json({
      schedulesExist,
      apiDataExist,
      reportExist,
      cacheFreshness,
      lastUpdated: reportExist ? fs.statSync(REPORT_FILE).mtime : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/schedule-report/fetch-and-compare
 * Fetch latest data from API and generate comparison report
 */
router.post('/fetch-and-compare', async (req, res) => {
  try {
    const force = req.body.force || false;

    // Fetch latest schedules from official API
    console.log('Fetching latest schedules from official API...');
    const schedules = await getLatestSchedules(force);

    if (!schedules || schedules.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Failed to fetch schedules from API'
      });
    }

    // Save fetched data as api-raw-data.json
    const apiRawData = schedules.map(s => ({
      stations: s.stations || [],
      trainCode: s.trainCode,
      success: s.success
    }));

    fs.writeFileSync(API_RAW_DATA_FILE, JSON.stringify(apiRawData, null, 2), 'utf8');

    // Generate report
    console.log('Generating comparison report...');
    const reportResult = generateReport();

    res.json({
      success: true,
      message: 'Data fetched and report generated successfully',
      fetchedSchedules: schedules.length,
      report: reportResult
    });
  } catch (error) {
    console.error('Error in fetch-and-compare:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/schedule-report/generate
 * Generate report from existing data
 */
router.post('/generate', (req, res) => {
  try {
    const result = generateReport();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/schedule-report/data
 * Get the report CSV data
 */
router.get('/data', (req, res) => {
  try {
    if (!fs.existsSync(REPORT_FILE)) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const csvContent = fs.readFileSync(REPORT_FILE, 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim());

    // Parse CSV into objects
    const headers = lines[0].split(',');
    const data = lines.slice(1).map(line => {
      const parts = line.split(',');
      const obj = {};
      headers.forEach((header, idx) => {
        obj[header] = parts[idx] || '';
      });
      return obj;
    });

    res.json({
      success: true,
      totalRecords: data.length,
      data: data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
