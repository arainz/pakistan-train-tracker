#!/bin/bash

# Pakistan Train Tracker - Hostinger Deployment Script
echo "🚂 Pakistan Train Tracker - Hostinger Deployment"
echo "================================================"

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

# Check if we're in the right directory
if [ ! -f "server.js" ]; then
    print_error "server.js not found. Please run this script from the project root directory."
    exit 1
fi

# Step 1: Create deployment directory
print_info "Creating deployment directory..."
mkdir -p deploy
cd deploy

# Step 2: Copy necessary files
print_info "Copying files..."
cp ../production-server.js ./server.js
cp ../production-package.json ./package.json
cp ../ecosystem.config.js ./
cp ../.env.example ./.env
cp -r ../public ./

# Step 3: Create logs directory
mkdir -p logs

# Step 4: Create start script
cat > start.sh << 'EOF'
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
EOF

chmod +x start.sh

# Step 5: Create stop script
cat > stop.sh << 'EOF'
#!/bin/bash
echo "🛑 Stopping Pakistan Train Tracker..."

if command -v pm2 &> /dev/null; then
    pm2 stop pakistan-train-tracker
    pm2 delete pakistan-train-tracker
else
    echo "⚠️ PM2 not available. Please stop the Node.js process manually."
fi
EOF

chmod +x stop.sh

# Step 6: Create restart script
cat > restart.sh << 'EOF'
#!/bin/bash
echo "🔄 Restarting Pakistan Train Tracker..."

if command -v pm2 &> /dev/null; then
    pm2 restart pakistan-train-tracker
else
    echo "⚠️ PM2 not available. Please restart the Node.js process manually."
    echo "Run: ./stop.sh && ./start.sh"
fi
EOF

chmod +x restart.sh

# Step 7: Create update script
cat > update.sh << 'EOF'
#!/bin/bash
echo "📥 Updating Pakistan Train Tracker..."

# Pull latest changes (if using git)
if [ -d ".git" ]; then
    git pull origin main
fi

# Install/update dependencies
npm install

# Restart the application
if command -v pm2 &> /dev/null; then
    pm2 restart pakistan-train-tracker
    pm2 save
else
    echo "Please restart the application manually: ./restart.sh"
fi
EOF

chmod +x update.sh

# Step 8: Create README for deployment
cat > README.md << 'EOF'
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
EOF

print_status "Deployment package created in 'deploy' directory"
print_info "Files created:"
echo "  📄 server.js (production server)"
echo "  📄 package.json"
echo "  📄 ecosystem.config.js (PM2 config)"
echo "  📄 .env (environment variables)"
echo "  📂 public/ (static files)"
echo "  📂 logs/ (log directory)"
echo "  🔧 start.sh, stop.sh, restart.sh, update.sh"
echo "  📖 README.md"

print_info "Next steps:"
echo "1. Upload the 'deploy' directory to your Hostinger server"
echo "2. SSH into your server"
echo "3. Navigate to the uploaded directory"
echo "4. Run: chmod +x *.sh"
echo "5. Run: ./start.sh"
echo ""
print_warning "Make sure Node.js is installed on your Hostinger server!"
print_info "You can check with: node --version"

cd ..
print_status "Deployment preparation complete! 🎉"