#!/bin/bash

# Health check script for all deployment platforms
# Monitors the health of applications across all three cloud providers

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration - Update these with your actual URLs
GCP_URL="${GCP_URL:-https://pakistan-train-tracker-cgh5kxvuiq-uc.a.run.app}"
ORACLE_URL="${ORACLE_URL:-http://138.2.91.18:3000}"
KOYEB_URL="${KOYEB_URL:-https://confused-eel-pakrail-7ab69761.koyeb.app}"

# Function to check health
check_health() {
    local url=$1
    local name=$2
    local timeout=10

    echo -n "Checking $name... "

    response=$(curl -s -w "\n%{http_code}" --connect-timeout $timeout "$url/health" 2>/dev/null)
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | head -n -1)

    if [ -z "$http_code" ]; then
        echo -e "${RED}✗${NC} Connection timeout"
        return 1
    elif [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓${NC} OK (HTTP $http_code)"
        if [ -n "$body" ]; then
            echo "  Response: $body"
        fi
        return 0
    else
        echo -e "${RED}✗${NC} HTTP $http_code"
        return 1
    fi
}

# Function to check live data
check_live_data() {
    local url=$1
    local name=$2
    local timeout=10

    echo -n "Checking live data for $name... "

    response=$(curl -s -w "\n%{http_code}" --connect-timeout $timeout "$url/api/live" 2>/dev/null | head -n 1)
    http_code=$(curl -s -w "%{http_code}" --connect-timeout $timeout -o /dev/null "$url/api/live" 2>/dev/null)

    if [ "$http_code" = "200" ]; then
        train_count=$(curl -s "$url/api/live" 2>/dev/null | grep -o '"count":[0-9]*' | head -1 | cut -d: -f2)
        echo -e "${GREEN}✓${NC} OK - $train_count trains"
        return 0
    else
        echo -e "${RED}✗${NC} HTTP $http_code"
        return 1
    fi
}

# Function to display server info
show_server_info() {
    local url=$1
    local name=$2

    echo -n "Fetching $name info... "

    info=$(curl -s --connect-timeout 5 "$url/health" 2>/dev/null)

    if [ -n "$info" ]; then
        echo -e "${GREEN}✓${NC}"
        echo "$info" | jq . 2>/dev/null || echo "$info"
    else
        echo -e "${RED}✗${NC} No response"
    fi
}

# Parse command line arguments
case "${1:-full}" in
    health)
        echo -e "\n${BLUE}=== Health Check ===${NC}\n"
        check_health "$GCP_URL" "Google Cloud Run"
        check_health "$ORACLE_URL" "Oracle Cloud"
        check_health "$KOYEB_URL" "Koyeb"
        ;;
    live)
        echo -e "\n${BLUE}=== Live Data Check ===${NC}\n"
        check_live_data "$GCP_URL" "Google Cloud Run"
        check_live_data "$ORACLE_URL" "Oracle Cloud"
        check_live_data "$KOYEB_URL" "Koyeb"
        ;;
    info)
        echo -e "\n${BLUE}=== Server Information ===${NC}\n"
        show_server_info "$GCP_URL" "Google Cloud Run"
        echo ""
        show_server_info "$ORACLE_URL" "Oracle Cloud"
        echo ""
        show_server_info "$KOYEB_URL" "Koyeb"
        ;;
    full)
        echo -e "\n${BLUE}╔════════════════════════════════════════╗${NC}"
        echo -e "${BLUE}║${NC}  Multi-Cloud Health Monitor"
        echo -e "${BLUE}╚════════════════════════════════════════╝${NC}\n"

        echo -e "${YELLOW}URLs:${NC}"
        echo "  GCP:    $GCP_URL"
        echo "  Oracle: $ORACLE_URL"
        echo "  Koyeb:  $KOYEB_URL"
        echo ""

        echo -e "${BLUE}=== Health Check ===${NC}\n"
        gcp_health=0
        oracle_health=0
        koyeb_health=0

        check_health "$GCP_URL" "Google Cloud Run" && gcp_health=1
        check_health "$ORACLE_URL" "Oracle Cloud" && oracle_health=1
        check_health "$KOYEB_URL" "Koyeb" && koyeb_health=1

        echo ""
        echo -e "${BLUE}=== Live Data ===${NC}\n"

        check_live_data "$GCP_URL" "Google Cloud Run"
        check_live_data "$ORACLE_URL" "Oracle Cloud"
        check_live_data "$KOYEB_URL" "Koyeb"

        echo ""
        echo -e "${BLUE}=== Summary ===${NC}\n"

        health_count=$((gcp_health + oracle_health + koyeb_health))
        echo "Healthy servers: $health_count / 3"
        [ $health_count -eq 3 ] && echo -e "${GREEN}All systems operational!${NC}" || echo -e "${YELLOW}Some servers are unavailable.${NC}"
        ;;
    help|--help|-h)
        cat << EOF
Usage: ./scripts/check-health.sh [command]

Commands:
  health      Check health endpoints only
  live        Check live data endpoints only
  info        Show detailed server information
  full        Complete health check (default)
  help        Show this help message

Configuration:
  Set environment variables to check different servers:
    GCP_URL=https://your-url ./scripts/check-health.sh
    ORACLE_URL=http://your-ip:3000 ./scripts/check-health.sh
    KOYEB_URL=https://your-url ./scripts/check-health.sh

Examples:
  ./scripts/check-health.sh
  ./scripts/check-health.sh health
  GCP_URL=https://new-url ./scripts/check-health.sh
EOF
        ;;
    *)
        echo "Unknown command: $1"
        echo "Use './scripts/check-health.sh help' for usage information"
        exit 1
        ;;
esac
