# Pakistan Train Tracker

A real-time train tracking application that fetches data from trackyourtrains.com and displays it in a user-friendly interface.

## Features

- **Live Train Tracking**: View active trains with current location and status
- **Train Schedule**: Browse train schedules with departure and arrival times
- **Search Functionality**: Search trains by number or name
- **Train Details**: View detailed information about specific trains including route
- **Auto-Refresh**: Data automatically updates every 5 minutes
- **Responsive Design**: Works on desktop and mobile devices

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open your browser and navigate to:
```
http://localhost:3000
```

## API Endpoints

- `GET /api/trains` - Get all active trains
- `GET /api/schedule` - Get train schedules
- `GET /api/train/:trainNumber` - Get specific train details
- `GET /api/search?query=xxx` - Search trains
- `GET /api/refresh` - Manually refresh data

## Technologies Used

- **Backend**: Node.js, Express.js
- **Web Scraping**: Axios, Cheerio
- **Frontend**: HTML, CSS, JavaScript
- **Scheduling**: Node-cron for periodic updates

## Notes

- Data is fetched from trackyourtrains.com using web scraping
- The application refreshes data every 5 minutes automatically
- Manual refresh is available via the refresh button