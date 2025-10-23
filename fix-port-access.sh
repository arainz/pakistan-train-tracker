#!/bin/bash

# Pakistan Train Tracker - Port Access Fix Script
echo "🚂 Pakistan Train Tracker - Port Access Fix"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check current Node.js processes
print_info "Checking current Node.js processes..."
ps aux | grep node

# Stop existing Node.js processes
print_info "Stopping existing Node.js processes..."
pkill -f "node.*server.js" || echo "No existing processes found"
pkill -f "pm2" || echo "No PM2 processes found"

# Check if we can access port 80 (requires root)
print_info "Checking port availability..."
if netstat -tlnp | grep :80 > /dev/null; then
    print_warning "Port 80 is already in use"
else
    print_info "Port 80 is available"
fi

if netstat -tlnp | grep :3001 > /dev/null; then
    print_warning "Port 3001 is already in use"
else
    print_info "Port 3001 is available"
fi

# Copy the port-fix server
if [ -f "port-fix-server.js" ]; then
    print_info "Using port-fix-server.js..."
    cp port-fix-server.js current-server.js
else
    print_info "Using production-server.js..."
    cp production-server.js current-server.js
fi

# Create a startup script that tries multiple ports
cat > start-with-port-fallback.sh << 'EOF'
#!/bin/bash

echo "🚀 Starting Pakistan Train Tracker with port fallback..."

# Array of ports to try
PORTS=(80 8080 3000 3001 8000 5000)

for PORT in "${PORTS[@]}"; do
    echo "🔌 Trying port $PORT..."
    
    # Check if port is available
    if ! netstat -tlnp | grep ":$PORT " > /dev/null; then
        echo "✅ Port $PORT is available, starting server..."
        
        # Set environment variable and start
        export PORT=$PORT
        
        if command -v pm2 &> /dev/null; then
            echo "📦 Starting with PM2 on port $PORT..."
            pm2 start current-server.js --name "train-tracker-$PORT" --env production -- --port $PORT
            pm2 save
            echo "🌟 Server started on port $PORT"
            echo "🔗 Access at: http://pakrail.aimworld.org:$PORT"
            break
        else
            echo "📦 Starting with Node.js on port $PORT..."
            node current-server.js &
            echo "🌟 Server started on port $PORT"
            echo "🔗 Access at: http://pakrail.aimworld.org:$PORT"
            break
        fi
    else
        echo "❌ Port $PORT is already in use"
    fi
done

echo "📊 Server status:"
ps aux | grep node
netstat -tlnp | grep node
EOF

chmod +x start-with-port-fallback.sh

# Create an Apache/Nginx proxy configuration
cat > apache-proxy.conf << 'EOF'
# Apache Virtual Host Configuration for Pakistan Train Tracker
# Add this to your Apache configuration or .htaccess

<VirtualHost *:80>
    ServerName pakrail.aimworld.org
    DocumentRoot /home/pakrail.aimworld.org/public_html
    
    # Proxy requests to Node.js app
    ProxyPreserveHost On
    ProxyRequests Off
    ProxyPass /api/ http://localhost:3001/api/
    ProxyPassReverse /api/ http://localhost:3001/api/
    ProxyPass /health http://localhost:3001/health
    ProxyPassReverse /health http://localhost:3001/health
    
    # Serve static files directly
    Alias /static /home/pakrail.aimworld.org/public_html/public
    
    # Fallback to Node.js for everything else
    ProxyPass / http://localhost:3001/
    ProxyPassReverse / http://localhost:3001/
    
    ErrorLog logs/pakrail_error.log
    CustomLog logs/pakrail_access.log combined
</VirtualHost>
EOF

# Create Nginx proxy configuration
cat > nginx-proxy.conf << 'EOF'
# Nginx Configuration for Pakistan Train Tracker
# Add this to your Nginx sites configuration

server {
    listen 80;
    server_name pakrail.aimworld.org;
    
    # Serve static files directly
    location /static/ {
        alias /home/pakrail.aimworld.org/public_html/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Proxy API requests to Node.js
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Proxy health check
    location /health {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # Proxy everything else to Node.js
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Create .htaccess for subdirectory proxy
cat > .htaccess << 'EOF'
# Pakistan Train Tracker - Apache Proxy via .htaccess
RewriteEngine On

# Proxy API requests to Node.js server
RewriteCond %{REQUEST_URI} ^/api/
RewriteRule ^(.*)$ http://localhost:3001/$1 [P,L]

# Proxy health check
RewriteCond %{REQUEST_URI} ^/health$
RewriteRule ^(.*)$ http://localhost:3001/$1 [P,L]

# For all other requests, try to serve static files first
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ http://localhost:3001/$1 [P,L]
EOF

# Try to start the server
print_info "Starting server with port fallback..."
./start-with-port-fallback.sh

print_status "Port access fix setup complete!"
print_info "Files created:"
echo "  🔧 start-with-port-fallback.sh (multi-port startup)"
echo "  🔧 current-server.js (optimized server)"
echo "  📄 apache-proxy.conf (Apache reverse proxy config)"
echo "  📄 nginx-proxy.conf (Nginx reverse proxy config)"
echo "  📄 .htaccess (Apache subdirectory proxy)"

print_info "Next steps:"
echo "1. The server should now be running on an available port"
echo "2. Check which port it's using: ps aux | grep node"
echo "3. Test access: curl http://localhost:PORT/health"
echo "4. For external access without ports, configure reverse proxy:"
echo "   - Copy apache-proxy.conf to your Apache config, OR"
echo "   - Copy nginx-proxy.conf to your Nginx config, OR"
echo "   - Copy .htaccess to your web root directory"

print_warning "If external access still doesn't work:"
echo "1. Check Hostinger firewall settings"
echo "2. Contact Hostinger support about opening custom ports"
echo "3. Use the reverse proxy configuration to access via port 80"