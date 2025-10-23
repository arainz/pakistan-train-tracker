#!/bin/bash
echo "🔄 Restarting Pakistan Train Tracker..."

if command -v pm2 &> /dev/null; then
    pm2 restart pakistan-train-tracker
else
    echo "⚠️ PM2 not available. Please restart the Node.js process manually."
    echo "Run: ./stop.sh && ./start.sh"
fi
