#!/usr/bin/env node

/**
 * Fetch fresh data from Pakistan Railways Official API
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = '/tmp/merge_data';
const DELAY_MS = 500;

// Helper to make HTTPS POST requests
function httpsPost(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://www.pakrailways.gov.pk',
        'Referer': 'https://www.pakrailways.gov.pk/',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Site': 'same-site',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${e.message}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Helper to make HTTPS GET requests
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://www.pakrailways.gov.pk',
        'Referer': 'https://www.pakrailways.gov.pk/',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Site': 'same-site',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty'
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🚀 Fetching NEW data from Pakistan Railways Official API\n');
  
  // Step 1: Fetch all stations
  console.log('📍 Step 1: Fetching all stations...');
  const stationsResponse = await httpsGet('https://isapi.pakrailways.gov.pk/v1/ticket/getStations');
  const stations = stationsResponse.rows || stationsResponse.data || [];
  console.log(`✅ Loaded ${stations.length} stations\n`);
  
  // Step 2: Fetch trains from major routes
  console.log('🚂 Step 2: Fetching trains from major routes...');
  const routes = [
    { from: 'KCT', to: 'PSH', name: 'Karachi Cantt → Peshawar City' },
    { from: 'KCT', to: 'LHR', name: 'Karachi Cantt → Lahore' },
    { from: 'KCT', to: 'RWP', name: 'Karachi Cantt → Rawalpindi' },
    { from: 'LHR', to: 'PSC', name: 'Lahore → Peshawar Cantt' },
    { from: 'LHR', to: 'KCT', name: 'Lahore → Karachi Cantt' },
    { from: 'PSC', to: 'KCT', name: 'Peshawar Cantt → Karachi Cantt' },
    { from: 'PSC', to: 'LHR', name: 'Peshawar Cantt → Lahore' },
    { from: 'RWP', to: 'KCT', name: 'Rawalpindi → Karachi Cantt' },
    { from: 'KCT', to: 'QTA', name: 'Karachi Cantt → Quetta' },
    { from: 'QTA', to: 'KCT', name: 'Quetta → Karachi Cantt' },
  ];
  
  const trainMap = new Map(); // journeyId -> train details
  // Use Oct 31st as it has current schedule data
  const travelDate = '2025-10-31';
  
  for (const route of routes) {
    console.log(`  Searching: ${route.name}...`);
    await delay(DELAY_MS);
    
    try {
      const result = await httpsPost('https://isapi.pakrailways.gov.pk/v1/ticket/trainInfo/trainInfoList', {
        boardStationCode: route.from,
        arrivalStationCode: route.to,
        travelDate: travelDate
      });
      
      const trains = result.data || result.rows || [];
      console.log(`    Found ${trains.length} trains`);
      
      trains.forEach(train => {
        // Extract journey ID from trainDirDay.id (numeric ID like 102448)
        const journeyId = train.trainDirDay?.id;
        const trainCode = train.trainDirDay?.trainCode;
        if (journeyId && trainCode) {
          trainMap.set(journeyId, {
            journeyId: journeyId,
            trainCode: trainCode,
            trainName: `${trainCode}`, // Will get proper name from schedule
            boardTime: train.boardTime
          });
        }
      });
    } catch (error) {
      console.log(`    ⚠️  Error: ${error.message}`);
    }
  }
  
  console.log(`\n✅ Total unique trains found: ${trainMap.size}\n`);
  
  // Step 3: Fetch detailed schedules for each train
  console.log('📋 Step 3: Fetching detailed schedules...');
  const schedules = [];
  let count = 0;
  
  for (const [journeyId, train] of trainMap.entries()) {
    count++;
    console.log(`  [${count}/${trainMap.size}] Fetching schedule for ${train.trainCode} (${train.trainName})...`);
    await delay(DELAY_MS);
    
    try {
      const result = await httpsGet(`https://isapi.pakrailways.gov.pk/v1/ticket/trainInfo/stopTimeTable/${journeyId}`);
      const scheduleData = result.data || result.rows || [];
      
      if (scheduleData.length > 0) {
        // Extract departure and arrival times
        // API returns boardTime (departure) for each station
        // We don't have separate arrival times, so we'll leave them empty and let merge keep old data
        schedules.push({
          TrainCode: train.trainCode,
          TrainName: scheduleData[0].stationTrainCode || train.trainCode,
          stations: scheduleData.map((station, index) => {
            return {
              StationCode: station.station?.stationCode || '',
              StationName: station.station?.stationNameEn || '',
              DepartureTime: station.boardTime ? station.boardTime.split('T')[1].substring(0, 5) : '',
              ArrivalTime: null, // API doesn't provide arrival time separately, keep old data
              Distance: parseFloat(station.distance) || 0
            };
          })
        });
        console.log(`    ✅ ${scheduleData.length} stations`);
      }
    } catch (error) {
      console.log(`    ⚠️  Error: ${error.message}`);
    }
  }
  
  // Save to files
  console.log(`\n💾 Saving NEW data...`);
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'new_stations.json'),
    JSON.stringify({ Response: stations }, null, 2)
  );
  console.log(`✅ Saved ${stations.length} stations to new_stations.json`);
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'new_schedules.json'),
    JSON.stringify({ Response: schedules }, null, 2)
  );
  console.log(`✅ Saved ${schedules.length} schedules to new_schedules.json`);
  
  console.log('\n🎉 Done! NEW data saved to /tmp/merge_data/');
}

main().catch(console.error);

