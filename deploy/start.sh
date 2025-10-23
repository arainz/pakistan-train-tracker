#!/bin/bash
echo "🚀 Starting Pakistan Train Tracker..."

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start with PM2 if available, otherwise use node
if command -v pm2 &> /dev/null; then
    echo "🔄 Starting with PM2..."
    pm2 start ecosystem.config.js --env production
    pm2 save
else
    echo "🔄 Starting with Node.js..."
    node server.js
fi
