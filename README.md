# MindfulMe - Full-Stack Local-AI Mental Health Tracker

**Production-ready mental health tracking application using 100% local machine learning models (no external APIs)**

🚀 **Status**: ✅ Implementation Complete (January 20, 2026)

---

## 📋 Project Overview

MindfulMe is a comprehensive mental health tracking platform that analyzes user wellness through:

- **Text Analysis**: Sentiment classification and emotion detection using DistilBERT
- **Voice Analysis**: Vocal biomarkers (pitch, jitter, shimmer) for stress detection
- **Behavioral Tracking**: Medication adherence and mental health trends
- **Predictive Insights**: Burnout risk scoring with 7-day forecasts

### Key Features
✅ **100% Local Processing** - No cloud APIs, no external dependencies  
✅ **Privacy-First** - All data stored locally, encrypted audio storage  
✅ **Production-Ready** - Comprehensive error handling, logging, validation  
✅ **Real-Time Analysis** - Live sentiment analysis during journaling  
✅ **Visual Dashboard** - 7-day pulse trends with burnout risk indicators  
✅ **Offline Capable** - Works completely disconnected from internet  

---

## 🏗️ Technology Stack

### Frontend
- **React Native** (Expo) - Cross-platform mobile app
- **VictoryNative** - Advanced chart visualizations
- **Redux** - State management

### Backend
- **Node.js + Express** - REST API server
- **PostgreSQL** - Relational data storage
- **JWT** - Secure authentication

### ML Service  
- **FastAPI** - Python async API server
- **Transformers** - DistilBERT for sentiment/emotion
- **Librosa** - Audio feature extraction
- **scikit-learn** - ML models for classification & prediction

---

## 🚀 Quick Start (5 Minutes)

### Prerequisites
```bash
python3 --version  # 3.9+
node --version     # 18+
npm --version      # 9+
```

### Setup
```bash
# 1. Setup database
sudo -u postgres psql -c "CREATE DATABASE mindfulme; CREATE USER mindful_user WITH PASSWORD 'password'; GRANT ALL PRIVILEGES ON DATABASE mindfulme TO mindful_user;"
psql -U mindful_user -d mindfulme -f database/schema.sql

# 2. Start ML Service (Terminal 1)
cd ml-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py

# 3. Start Backend (Terminal 2)
cd backend
npm install
npm start

# 4. Start Frontend (Terminal 3)
cd frontend
npm install
npm start
```

### Verify
```bash
curl http://localhost:8000/health
curl http://localhost:3000/api/health
# Open http://localhost:19000 on phone with Expo Go
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

