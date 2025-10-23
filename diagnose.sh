#!/bin/bash

echo "🔍 Pakistan Train Tracker - Connection Diagnostics"
echo "================================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${GREEN}✅ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }

echo ""
print_info "1. Checking Node.js processes..."
NODE_PROCESSES=$(ps aux | grep "node.*server.js" | grep -v grep)
if [ -n "$NODE_PROCESSES" ]; then
    print_status "Node.js server is running:"
    echo "$NODE_PROCESSES"
else
    print_error "No Node.js server processes found"
fi

echo ""
print_info "2. Checking port usage..."
for PORT in 80 3000 3001 8080; do
    if netstat -tlnp 2>/dev/null | grep ":$PORT " > /dev/null; then
        print_status "Port $PORT is in use:"
        netstat -tlnp 2>/dev/null | grep ":$PORT "
    else
        print_warning "Port $PORT is not in use"
    fi
done

echo ""
print_info "3. Testing local connections..."
for PORT in 3000 3001 8080; do
    echo -n "Testing localhost:$PORT... "
    if curl -s --connect-timeout 3 "http://localhost:$PORT/health" > /dev/null; then
        print_status "localhost:$PORT responds"
        WORKING_PORT=$PORT
    else
        print_error "localhost:$PORT not responding"
    fi
done

if [ -n "$WORKING_PORT" ]; then
    echo ""
    print_info "4. Testing local health endpoint on port $WORKING_PORT..."
    curl -s "http://localhost:$WORKING_PORT/health" | head -3
    
    echo ""
    print_info "5. Testing local API endpoint..."
    API_RESPONSE=$(curl -s "http://localhost:$WORKING_PORT/api/live" | head -200)
    if echo "$API_RESPONSE" | grep -q '"success":true'; then
        LIVE_COUNT=$(echo "$API_RESPONSE" | grep -o '"count":[0-9]*' | cut -d':' -f2)
        print_status "API working! Live trains: $LIVE_COUNT"
    else
        print_warning "API response unclear"
    fi
fi

echo ""
print_info "6. Checking firewall and network..."
print_info "System information:"
echo "Hostname: $(hostname)"
echo "IP addresses:"
ip addr show 2>/dev/null | grep "inet " | grep -v "127.0.0.1" || ifconfig 2>/dev/null | grep "inet " | grep -v "127.0.0.1"

echo ""
print_info "7. Testing external connectivity..."
print_info "Trying to connect to external IP from inside server..."
EXTERNAL_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null)
if [ -n "$EXTERNAL_IP" ]; then
    echo "External IP: $EXTERNAL_IP"
    if [ -n "$WORKING_PORT" ]; then
        echo -n "Testing external connection... "
        if curl -s --connect-timeout 5 "http://$EXTERNAL_IP:$WORKING_PORT/health" > /dev/null; then
            print_status "External IP connection works!"
        else
            print_error "External IP connection blocked (likely firewall/hosting restriction)"
        fi
    fi
else
    print_warning "Could not determine external IP"
fi

echo ""
print_info "8. Recommendations based on findings:"

if [ -n "$WORKING_PORT" ]; then
    echo "✅ Server is working locally on port $WORKING_PORT"
    echo "⚠️  External access issue is likely due to:"
    echo "   1. Hostinger firewall blocking port $WORKING_PORT"
    echo "   2. Shared hosting network restrictions"
    echo "   3. Router/proxy configuration"
    echo ""
    echo "🔧 Solutions:"
    echo "   1. Contact Hostinger support about opening port $WORKING_PORT"
    echo "   2. Use Apache/Nginx reverse proxy (port 80 -> $WORKING_PORT)"
    echo "   3. Use our port-free PHP solution as fallback"
    echo "   4. Upload index.html to web root for user-friendly redirect"
else
    echo "❌ Server is not running properly"
    echo "🔧 Run: ./safe-start.sh to start the server"
fi

echo ""
print_info "9. Quick fixes to try:"
echo "Copy these files to your web root (/public_html):"
echo "   - index.html (user-friendly landing page)"
echo "   - .htaccess (attempts proxy forwarding)"
echo ""
echo "Or run this to create a port 80 redirect page:"
cat > /tmp/simple-redirect.html << 'EOF'
<!DOCTYPE html><html><head><title>Pakistan Train Tracker</title><meta http-equiv="refresh" content="0;url=http://pakrail.aimworld.org:3001"><style>body{font-family:Arial;text-align:center;padding:50px;}h1{color:#1e3c72;}</style></head><body><h1>🚂 Pakistan Train Tracker</h1><p>Redirecting to live tracker...</p><p><a href="http://pakrail.aimworld.org:3001">Click here if not redirected automatically</a></p></body></html>
EOF
echo "Created simple redirect at: /tmp/simple-redirect.html"
echo "Copy this to your web root as index.html"