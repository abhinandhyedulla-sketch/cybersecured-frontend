# AegisGuard SOC Command Center - Frontend

This directory contains the client-side user interface for the AegisGuard Cyber Defense Platform.

## Structure
- `index.html`: Main Security Operations Center (SOC) Command Center dashboard
- `login.html`: Authentication portal (Sign in, Registration, AI Assistant, API Key tester)
- `css/styles.css`: Dark-mode HUD interface styles, glassmorphism, animations
- `js/app.js`: Real-time dashboard engine, telemetry charts, REST API client

## Running the Frontend

### Option 1: Using Vite (Recommended for Local Dev)
Requires Node.js 18+:
```bash
npm install
npm run dev
```
The application will launch at `http://localhost:3000` with hot-reload and automatically proxy all `/api` requests to Spring Boot on `http://localhost:8080`.

### Option 2: Live Server or Any Static Web Server
You can open `index.html` or `login.html` directly with VS Code Live Server (port 5500) or Python http server:
```bash
python -m http.server 3000
```
The frontend automatically detects when it is running on a port other than 8080 and directs API calls to `http://localhost:8080/api`.

### Option 3: Docker
```bash
docker build -t aegisguard-frontend .
docker run -p 3000:80 aegisguard-frontend
```
