# MindfulMe - Mental Health Platform

A production-ready Mental Health Platform with multi-modal AI (Voice, Text, Behavior) for predicting mental health trends.

## Features
- Multi-step Onboarding with PHQ-9 and GAD-7 assessments
- Mental Health Index (MHI) calculation
- Voice Journal with vocal biometrics analysis (pitch, jitter, shimmer, cadence)
- Text Analysis with real-time sentiment detection
- Predictive Analytics with proactive wellness alerts (20% decline trigger)
- Medication Tracker with mood correlation
- JWT Authentication with Biometric (FaceID) support
- End-to-end encryption for sensitive data
- Professional Doctor Portal with time-limited access tokens

## Quick Start

### 1. Database (PostgreSQL)
```bash
# Create database
psql -U postgres -c "CREATE DATABASE mindfulme;"

# Run schema
psql -U postgres -d mindfulme -f database/schema.sql
```

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env  # Configure your settings
npm run dev           # Runs on http://localhost:3000
```

### 3. ML Service
```bash
cd ml-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --port 8000  # Runs on http://localhost:8000
```

### 4. Frontend
```bash
cd frontend
npm install
npx react-native run-ios   # or run-android
```

## Mental Health Index Formula
```
MHI = 100 - (PHQ-9 × 2 + GAD-7 × 2 + (10-mood) × 3 + (10-sleep) × 1.5 + anxiety × 1.5)
```

## Detailed Setup Guide
See [SETUP_GUIDE.md](SETUP_GUIDE.md) for complete installation instructions including:
- Database configuration
- Environment variable setup
- Troubleshooting tips
- API documentation

## Architecture
```
MindfulMe/
├── frontend/          # React Native (iOS/Android)
├── backend/           # Node.js Express + TypeScript
├── ml-service/        # Python FastAPI (Voice & Text AI)
└── database/          # PostgreSQL Schema
```

## License

MIT

