# Pakistan Railways Web Scraper 🚂

Extract train schedules from [pakrailways.gov.pk](https://www.pakrailways.gov.pk) and save to JSON format.

## 📋 Overview

This scraper analyzes and extracts train schedule data from the Pakistan Railways RABTA system and saves it in a format compatible with your mobile app.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd scraper
npm install
```

This will install:
- **Puppeteer** - Headless browser for scraping JavaScript-heavy sites
- **Cheerio** - HTML parsing
- **Axios** - HTTP requests

### 2. Analyze RABTA Website Structure

**First, run the analyzer** to understand the website structure:

```bash
npm run analyze
```

This will:
- ✅ Open Pakistan Railways website in a browser
- ✅ Analyze page structure (forms, tables, links)
- ✅ Take screenshots
- ✅ Save analysis to `rabta-analysis.json`
- ✅ Keep browser open for 30 seconds for manual inspection

**Output Files:**
- `rabta-analysis.json` - Complete page structure analysis
- `rabta-screenshot.png` - Full page screenshot

### 3. Run the Scraper

After analyzing the structure, run the scraper:

```bash
npm run scrape
```

**Output:**
- `public/data/scraped-stations.json` - All railway stations
- `public/data/scraped-trains.json` - All train schedules

## 📁 Files

```
scraper/
├── package.json              # Dependencies
├── analyze-rabta.js          # Website structure analyzer
├── pakrailways-scraper.js    # Main scraper
├── README.md                 # This file
└── Output files:
    ├── rabta-analysis.json   # Structure analysis
    ├── rabta-screenshot.png  # Website screenshot
    └── ../public/data/
        ├── scraped-stations.json
        └── scraped-trains.json
```

## 🔧 How It Works

### Step 1: Analysis Phase

The analyzer (`analyze-rabta.js`):

1. Opens Pakistan Railways website
2. Waits for JavaScript to load
3. Extracts:
   - Navigation links
   - Forms and inputs (for train search)
   - Tables (potential schedule data)
   - Dropdown selects (stations, trains)
   - RABTA system elements
4. Saves analysis for review

### Step 2: Scraping Phase

The scraper (`pakrailways-scraper.js`):

1. Initializes headless browser
2. Navigates to RABTA system
3. Extracts train schedule data
4. Formats to JSON
5. Saves to `public/data/`

## 📊 Data Format

### Stations JSON

```json
{
  "lastUpdated": "2025-10-27T13:00:00.000Z",
  "source": "pakrailways.gov.pk",
  "dataCount": 150,
  "data": [
    {
      "name": "Karachi Cantt",
      "code": "KC",
      "coordinates": { "lat": 24.8607, "lng": 67.0011 }
    }
  ]
}
```

### Trains JSON

```json
{
  "lastUpdated": "2025-10-27T13:00:00.000Z",
  "source": "pakrailways.gov.pk",
  "dataCount": 50,
  "data": [
    {
      "number": "1",
      "name": "Khyber Mail",
      "type": "Express",
      "schedule": [
        {
          "station": "Karachi Cantt",
          "arrival": "00:00",
          "departure": "20:00",
          "day": 0
        }
      ]
    }
  ]
}
```

## 🔄 Integration with Your App

Once scraped, integrate the data:

### Option 1: Replace Current Data

```bash
# Backup current data
cp public/data/trains.json public/data/trains.backup.json
cp public/data/stations.json public/data/stations.backup.json

# Use scraped data
cp public/data/scraped-trains.json public/data/trains.json
cp public/data/scraped-stations.json public/data/stations.json
```

### Option 2: Merge Data

Create a merge script to combine official data with existing data.

### Option 3: Automated Updates

Set up a cron job or GitHub Action to run scraper daily:

```yaml
# .github/workflows/scrape-schedules.yml
name: Update Train Schedules

on:
  schedule:
    - cron: '0 0 * * *'  # Daily at midnight
  workflow_dispatch:  # Manual trigger

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: cd scraper && npm install
      - run: cd scraper && npm run scrape
      - uses: stefanzweifel/git-auto-commit-action@v4
        with:
          commit_message: 'Update train schedules from pakrailways.gov.pk'
```

## ⚙️ Customization

### Update Scraping Logic

Edit `pakrailways-scraper.js` based on the RABTA structure found by the analyzer:

```javascript
// Example: If trains are in a specific table
const trains = await page.evaluate(() => {
    const trainTable = document.querySelector('#train-schedule-table');
    const rows = trainTable.querySelectorAll('tr');
    
    return Array.from(rows).map(row => {
        const cells = row.querySelectorAll('td');
        return {
            number: cells[0]?.textContent?.trim(),
            name: cells[1]?.textContent?.trim(),
            departure: cells[2]?.textContent?.trim(),
            // ... customize based on actual structure
        };
    });
});
```

## 🐛 Troubleshooting

### Browser Won't Launch

```bash
# Install Chromium dependencies (Ubuntu/Debian)
sudo apt-get install -y chromium-browser

# Or use system Chrome
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
```

### Timeout Errors

Increase timeout in scraper:

```javascript
await page.goto(url, {
    waitUntil: 'networkidle2',
    timeout: 60000  // 60 seconds
});
```

### JavaScript Not Loading

The RABTA system requires JavaScript. Make sure:
- Puppeteer's `headless: 'new'` is used
- Wait for `networkidle2`
- Add delays: `await page.waitForTimeout(5000)`

## 📝 Notes

### Legal Considerations

- ✅ Scraping public data is generally legal
- ⚠️ Check Pakistan Railways terms of service
- ✅ Use scraped data responsibly
- ✅ Add attribution: "Data from Pakistan Railways"
- ⚠️ Don't overload their server (add delays)

### Rate Limiting

Add delays between requests:

```javascript
await page.waitForTimeout(2000); // 2 second delay
```

### Data Quality

- Validate scraped data before using
- Compare with existing data
- Handle missing/malformed data
- Log errors for review

## 🎯 Next Steps

1. **Run Analyzer First**
   ```bash
   npm run analyze
   ```

2. **Review Output**
   - Check `rabta-screenshot.png`
   - Review `rabta-analysis.json`

3. **Customize Scraper**
   - Update selectors in `pakrailways-scraper.js`
   - Match actual RABTA structure

4. **Test Scraping**
   ```bash
   npm run scrape
   ```

5. **Validate Data**
   - Check `scraped-trains.json`
   - Compare with existing data

6. **Integrate**
   - Update app to use new data
   - Test thoroughly

## 📞 Support

If the RABTA structure changes:
1. Run analyzer again
2. Update scraper selectors
3. Re-test scraping

---

**Made with ❤️ for Pak Train Live** 🚂✨

