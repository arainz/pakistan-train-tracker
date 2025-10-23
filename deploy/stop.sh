#!/bin/bash
echo "🛑 Stopping Pakistan Train Tracker..."

if command -v pm2 &> /dev/null; then
    pm2 stop pakistan-train-tracker
    pm2 delete pakistan-train-tracker
else
    echo "⚠️ PM2 not available. Please stop the Node.js process manually."
fi
