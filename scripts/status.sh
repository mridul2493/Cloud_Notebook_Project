#!/bin/bash

# Academic Notebook Cloud Platform - Status Check Script

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🚀 Academic Notebook Cloud Platform - Status Check"
echo "=================================================="
echo

# Check Frontend (Next.js)
echo -n "Frontend (Next.js): "
if curl -s http://localhost:3000 > /dev/null; then
    echo -e "${GREEN}✅ Running on http://localhost:3000${NC}"
else
    echo -e "${RED}❌ Not responding${NC}"
fi

# Check Backend (Node.js)
echo -n "Backend (Node.js): "
if curl -s http://localhost:5003/health > /dev/null; then
    echo -e "${GREEN}✅ Running on http://localhost:5003${NC}"
    
    # Get backend health info
    HEALTH_INFO=$(curl -s http://localhost:5003/health | jq -r '.service + " - " + .status' 2>/dev/null || echo "healthy")
    echo "   Status: $HEALTH_INFO"
else
    echo -e "${RED}❌ Not responding${NC}"
fi

echo
echo "📊 Process Status:"
echo "=================="

# Check Node.js processes
NODE_PROCESSES=$(ps aux | grep node | grep -v grep | wc -l | tr -d ' ')
echo "Active Node.js processes: $NODE_PROCESSES"

# Show specific processes
echo
echo "🔍 Running Processes:"
ps aux | grep -E "(next|nodemon|concurrently)" | grep -v grep | while read line; do
    echo "   • $line"
done

echo
echo "🌐 Access URLs:"
echo "=============="
echo -e "Frontend: ${BLUE}http://localhost:3000${NC}"
echo -e "Backend API: ${BLUE}http://localhost:5003/api${NC}"
echo -e "Backend Health: ${BLUE}http://localhost:5003/health${NC}"

echo
echo "📝 Quick Test Commands:"
echo "======================"
echo "curl http://localhost:3000                    # Test frontend"
echo "curl http://localhost:5003/health             # Test backend health"
echo "curl http://localhost:5003/api/auth/me        # Test API (requires auth)"

echo
echo "🔧 Management Commands:"
echo "======================"
echo "npm run dev                                   # Start both servers"
echo "npm run dev:frontend                         # Start only frontend"
echo "npm run dev:backend                          # Start only backend"
echo "docker-compose up -d                         # Start with Docker"
