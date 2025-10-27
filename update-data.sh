#!/bin/bash

# Script to update train schedule data
# Run this monthly or when Pakistan Railways announces schedule changes

echo "🚂 Updating Train Schedule Data..."
echo "===================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if data directory exists
if [ ! -d "public/data" ]; then
    echo "${YELLOW}Creating data directory...${NC}"
    mkdir -p public/data
fi

# Backup existing files
if [ -f "public/data/schedules.json" ]; then
    echo "${YELLOW}📦 Backing up existing files...${NC}"
    BACKUP_DIR="public/data/backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    cp public/data/*.json "$BACKUP_DIR/" 2>/dev/null || true
    echo "${GREEN}✅ Backup created: $BACKUP_DIR${NC}"
    echo ""
fi

# Download new data
echo "${YELLOW}📥 Downloading latest data from pakrail.rise.com.pk...${NC}"
echo ""

echo "  Downloading stations..."
curl -s "https://pakrail.rise.com.pk/data/stations.json" \
  -o public/data/stations.json

if [ $? -eq 0 ]; then
    SIZE=$(wc -c < public/data/stations.json | tr -d ' ')
    echo "  ${GREEN}✅ Stations data downloaded ($SIZE bytes)${NC}"
else
    echo "  ❌ Failed to download stations data"
    exit 1
fi

echo "  Downloading trains..."
curl -s "https://pakrail.rise.com.pk/data/trains.json" \
  -o public/data/trains.json

if [ $? -eq 0 ]; then
    SIZE=$(wc -c < public/data/trains.json | tr -d ' ')
    echo "  ${GREEN}✅ Trains data downloaded ($SIZE bytes)${NC}"
else
    echo "  ❌ Failed to download trains data"
    exit 1
fi

echo "  Downloading schedules..."
curl -s "https://pakrail.rise.com.pk/data/schedules.json" \
  -o public/data/schedules.json

if [ $? -eq 0 ]; then
    SIZE=$(wc -c < public/data/schedules.json | tr -d ' ')
    echo "  ${GREEN}✅ Schedules data downloaded ($SIZE bytes)${NC}"
else
    echo "  ❌ Failed to download schedules data"
    exit 1
fi

echo ""

# Create version file
echo "${YELLOW}📝 Updating version file...${NC}"
cat > public/data/version.json << EOF
{
  "version": "$(date +%Y%m%d)",
  "lastUpdated": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "source": "pakrail.rise.com.pk"
}
EOF
echo "${GREEN}✅ Version file updated${NC}"
echo ""

# Show summary
echo "${GREEN}===================================="
echo "✅ Data Update Complete!"
echo "====================================${NC}"
echo ""
echo "📊 Files:"
ls -lh public/data/*.json | awk '{print "  " $9 " (" $5 ")"}'
echo ""

# Git status
if command -v git &> /dev/null; then
    if [ -d ".git" ]; then
        echo "${YELLOW}📝 Git Status:${NC}"
        git status public/data/ --short
        echo ""
        echo "To commit these changes, run:"
        echo "  ${YELLOW}git add public/data/${NC}"
        echo "  ${YELLOW}git commit -m \"Update train data - $(date +%Y-%m-%d)\"${NC}"
        echo "  ${YELLOW}git push${NC}"
        echo ""
    fi
fi

echo "🎉 Done! Your app will now use the latest train schedules."
echo ""
echo "For mobile apps, remember to:"
echo "  1. Run: ${YELLOW}npx cap sync${NC}"
echo "  2. Build and test the app"
echo "  3. Submit update to app stores"

