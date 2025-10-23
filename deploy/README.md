# Pakistan Train Tracker - Hostinger Deployment

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the application:**
   ```bash
   ./start.sh
   ```

3. **Stop the application:**
   ```bash
   ./stop.sh
   ```

4. **Restart the application:**
   ```bash
   ./restart.sh
   ```

## Configuration

- Edit `.env` file for environment variables
- Default port: 3000
- Logs stored in: `logs/` directory

## Endpoints

- Main app: `http://your-domain.com:3000`
- Live data: `http://your-domain.com:3000/api/live`
- Health check: `http://your-domain.com:3000/health`

## PM2 Commands (if available)

- View logs: `pm2 logs pakistan-train-tracker`
- Monitor: `pm2 monit`
- Status: `pm2 status`

## Troubleshooting

1. Check logs: `cat logs/error.log`
2. Check if port is available: `netstat -tlnp | grep :3000`
3. Check Node.js version: `node --version`
