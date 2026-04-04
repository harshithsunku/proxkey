#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
ENV_FILE="$SCRIPT_DIR/.env"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

cleanup() {
    echo -e "\n${YELLOW}Shutting down...${NC}"
    [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null
    [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null
    wait 2>/dev/null
    echo -e "${GREEN}Stopped.${NC}"
}
trap cleanup EXIT INT TERM

# --- .env check ---
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}No .env file found. Creating from .env.example...${NC}"
    cp "$SCRIPT_DIR/.env.example" "$ENV_FILE"
    echo -e "${RED}Please edit .env with your Proxmox credentials, then re-run.${NC}"
    exit 1
fi

# --- Python setup ---
echo -e "${CYAN}[1/4] Setting up Python backend...${NC}"
cd "$BACKEND_DIR"

if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi
source .venv/bin/activate
pip install -q -r requirements.txt

# --- Node setup ---
echo -e "${CYAN}[2/4] Setting up Node frontend...${NC}"
cd "$FRONTEND_DIR"

if [ ! -d "node_modules" ]; then
    npm install --silent
fi

# --- Start backend ---
echo -e "${CYAN}[3/4] Starting backend on :8000...${NC}"
cd "$BACKEND_DIR"
source .venv/bin/activate
set -a; source "$ENV_FILE"; set +a
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Wait for backend to be ready
for i in $(seq 1 15); do
    if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

# --- Start frontend ---
echo -e "${CYAN}[4/4] Starting frontend on :5173...${NC}"
cd "$FRONTEND_DIR"
npx vite --host 0.0.0.0 &
FRONTEND_PID=$!

echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}  ProxKey is running!${NC}"
echo -e "${GREEN}==========================================${NC}"
echo -e "  Frontend : ${CYAN}http://localhost:5173${NC}"
echo -e "  Backend  : ${CYAN}http://localhost:8000${NC}"
echo -e "  API Docs : ${CYAN}http://localhost:8000/docs${NC}"
echo -e "${GREEN}==========================================${NC}"
echo -e "  Press ${YELLOW}Ctrl+C${NC} to stop"
echo ""

wait
