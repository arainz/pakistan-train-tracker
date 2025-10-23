#!/bin/bash

# Safe startup script for Pakistan Train Tracker
echo "🚂 Starting Pakistan Train Tracker (Safe Mode)"
echo "============================================="

# Stop any existing processes
echo "🛑 Stopping existing processes..."
pkill -f "node.*server.js" 2>/dev/null || echo "No existing Node.js processes found"
pkill -f "pm2" 2>/dev/null || echo "No PM2 processes found"

# Use port 3001 (safe, no root required)
export PORT=3001

echo "🔌 Using port: $PORT"
echo "📍 Server will be accessible at: http://pakrail.aimworld.org:$PORT"

# Start the server
if command -v pm2 &> /dev/null; then
    echo "📦 Starting with PM2..."
    pm2 start port-fix-server.js --name "train-tracker" --env production
    pm2 save
    pm2 status
else
    echo "📦 Starting with Node.js..."
    node port-fix-server.js &
    SERVER_PID=$!
    echo "🆔 Server PID: $SERVER_PID"
fi

# Wait a moment then check if server is running
sleep 3

echo ""
echo "📊 Server Status Check:"
if netstat -tlnp 2>/dev/null | grep :$PORT; then
    echo "✅ Server is running on port $PORT"
    echo "🔗 Test locally: curl http://localhost:$PORT/health"
    echo "🌐 Access externally: http://pakrail.aimworld.org:$PORT"
    echo "📊 API endpoint: http://pakrail.aimworld.org:$PORT/api/live"
else
    echo "❌ Server may not be running properly"
    echo "📋 Process check:"
    ps aux | grep "node.*server.js" | grep -v grep
fi

echo ""
echo "🎯 Next steps:"
echo "1. Test the health endpoint: curl http://localhost:$PORT/health"
echo "2. If local works but external doesn't, you may need to:"
echo "   - Contact Hostinger about firewall settings"
echo "   - Set up reverse proxy (see apache-proxy.conf or nginx-proxy.conf)"
echo "   - Use .htaccess for port forwarding"