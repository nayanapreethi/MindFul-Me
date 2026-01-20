# MindfulMe Complete Setup Guide

A complete guide to get MindfulMe running locally with all three services: ML Service, Backend, and Frontend.

## 📋 Prerequisites

### System Requirements
- **OS**: Linux (Ubuntu 20.04+ recommended), macOS, or WSL2 on Windows
- **Memory**: 8GB+ RAM (4GB minimum for ML models)
- **Storage**: 5GB free space (for ML models and cache)
- **Python**: 3.9 or higher
- **Node.js**: 18.x or higher
- **PostgreSQL**: 12 or higher

### Install System Dependencies (Ubuntu/Debian)
```bash
# Update package manager
sudo apt-get update && sudo apt-get upgrade -y

# Install Python dependencies
sudo apt-get install -y python3.9 python3.9-dev python3.9-venv python3-pip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib postgresql-dev

# Install audio processing libraries
sudo apt-get install -y libsndfile1 libsndfile1-dev sox

# Install build tools
sudo apt-get install -y build-essential
```

## 🗂️ Project Structure

```
MindFul Me/
├── ml-service/              # Python FastAPI ML service
│   ├── main.py             # Entry point
│   ├── requirements.txt     # Python dependencies
│   ├── app/
│   │   ├── services/
│   │   │   ├── sentiment_analysis.py
│   │   │   ├── voice_analysis.py
│   │   │   └── predictive_analysis.py
│   │   └── __init__.py
│   └── venv/              # Virtual environment
│
├── backend/                 # Node.js Express backend
│   ├── src/
│   │   ├── index.ts       # Entry point
│   │   ├── middleware/
│   │   └── routes/
│   │       ├── voice.ts
│   │       ├── medication.ts
│   │       ├── journal.ts
│   │       └── auth.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── node_modules/
│
├── frontend/                # React Native frontend
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Dashboard.tsx
│   │   │   └── PulseDashboard.tsx
│   │   ├── services/
│   │   ├── store/
│   │   └── utils/
│   │       └── config.ts
│   ├── package.json
│   └── node_modules/
│
├── database/
│   └── schema.sql         # Database initialization
│
└── [config files]
```

## 🚀 Step-by-Step Setup

### Step 1: Setup PostgreSQL Database

```bash
# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Connect to PostgreSQL as default user
sudo -u postgres psql

# Create database and user
CREATE DATABASE mindfulme;
CREATE USER mindful_user WITH PASSWORD 'your_secure_password';
ALTER ROLE mindful_user SET client_encoding TO 'utf8';
ALTER ROLE mindful_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE mindful_user SET default_transaction_deferrable TO on;
ALTER ROLE mindful_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE mindfulme TO mindful_user;
\q
```

Initialize schema:
```bash
psql -U mindful_user -d mindfulme -f database/schema.sql
```

### Step 2: Setup ML Service (FastAPI)

```bash
cd ml-service

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip setuptools wheel

# Install dependencies
pip install -r requirements.txt

# Download ML models (first run - takes ~5 minutes)
python -c "
from transformers import pipeline
print('Downloading models...')
sentiment = pipeline('sentiment-analysis', model='cardiffnlp/twitter-roberta-base-sentiment-latest')
emotions = pipeline('text-classification', model='j-hartmann/emotion-english-distilroberta-base')
print('✓ Models downloaded and cached')
"

# Start the ML service
python main.py
```

**Expected Output**:
```
INFO:     Started server process [XXXXX]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**Test the service** (in another terminal):
```bash
curl http://localhost:8000/health
# Response: {"status":"healthy",...}
```

### Step 3: Setup Backend (Node.js + Express)

**In a new terminal**:
```bash
cd backend

# Install dependencies
npm install

# Create .env file
cat > .env << EOF
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://mindful_user:your_secure_password@localhost:5432/mindfulme
JWT_SECRET=your_jwt_secret_key_here_min_32_chars
ML_SERVICE_URL=http://localhost:8000
EOF

# Run database migrations
npm run migrate

# Start backend server
npm start
```

**Expected Output**:
```
Server running on http://0.0.0.0:3000
Connected to PostgreSQL database
```

**Test the backend** (in another terminal):
```bash
curl http://localhost:3000/api/health
# Response: {"status":"ok",...}
```

### Step 4: Setup Frontend (React Native)

**In a new terminal**:
```bash
cd frontend

# Install dependencies
npm install

# Create .env file (optional - uses defaults from config.ts)
cat > .env << EOF
REACT_APP_API_BASE_URL=http://localhost:3000/api
REACT_APP_ML_SERVICE_URL=http://localhost:8000
REACT_APP_ENV=development
EOF

# Start Expo development server
npm start
```

**Expected Output**:
```
Expo DevTools is running at http://localhost:19000
Tunnel ready. Listening on all LAN interfaces.

Use Expo Go to scan this QR code:
[QR CODE DISPLAYED]
```

## 🔗 Connecting All Services

### Verification Checklist

1. **ML Service** (Port 8000)
   ```bash
   curl -s http://localhost:8000/health | jq .
   # Should show: {"status":"healthy",...}
   ```

2. **Backend** (Port 3000)
   ```bash
   curl -s http://localhost:3000/api/health | jq .
   # Should show: {"status":"ok",...}
   ```

3. **Frontend** (Port 19000/3000)
   ```bash
   # Scan QR code with Expo Go on phone or emulator
   # Should see MindfulMe app loading
   ```

4. **Database**
   ```bash
   psql -U mindful_user -d mindfulme -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
   # Should show: count > 0
   ```

### Integration Test

Test the complete flow:

```bash
# Terminal 1: Test ML Service text analysis
curl -X POST http://localhost:8000/analyze/text \
  -H "Content-Type: application/json" \
  -d '{"text":"I feel great today!"}'

# Terminal 2: Test Backend health
curl http://localhost:3000/api/health

# Terminal 3: Test Frontend connects to backend
# Check network tab in Expo DevTools
```

## 🛠️ Service Management

### Running All Services Simultaneously

Create a `run-all.sh` script:

```bash
#!/bin/bash

echo "🚀 Starting MindfulMe Services..."

# Start ML Service
echo "📡 Starting ML Service on port 8000..."
cd ml-service
source venv/bin/activate
python main.py > ml-service.log 2>&1 &
ML_PID=$!
echo "ML Service PID: $ML_PID"

# Wait for ML service to start
sleep 5

# Start Backend
echo "🔙 Starting Backend on port 3000..."
cd ../backend
npm start > backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend to start
sleep 3

# Start Frontend
echo "📱 Starting Frontend on port 19000..."
cd ../frontend
npm start > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo ""
echo "✓ All services started!"
echo ""
echo "📊 Service URLs:"
echo "  ML Service:  http://localhost:8000"
echo "  Backend:     http://localhost:3000"
echo "  Frontend:    http://localhost:19000"
echo ""
echo "📝 Log files:"
echo "  ML:       ml-service/ml-service.log"
echo "  Backend:  backend/backend.log"
echo "  Frontend: frontend/frontend.log"
echo ""
echo "To stop all services, run: kill $ML_PID $BACKEND_PID $FRONTEND_PID"

# Keep script running
wait
```

Make it executable:
```bash
chmod +x run-all.sh
./run-all.sh
```

### Individual Service Commands

**ML Service**:
```bash
cd ml-service
source venv/bin/activate
python main.py --reload  # Auto-reload on code changes
```

**Backend**:
```bash
cd backend
npm start          # Production start
npm run dev        # Development with auto-reload (if configured)
```

**Frontend**:
```bash
cd frontend
npm start          # Expo dev server
npm run web        # Web version (if supported)
npm run android    # Android emulator (if available)
```

## 🔧 Configuration

### Environment Variables

**ML Service** (`ml-service/.env`):
```
PORT=8000
LOG_LEVEL=INFO
WORKERS=4
```

**Backend** (`.env`):
```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/mindfulme
JWT_SECRET=your_secret_min_32_chars
JWT_EXPIRY=7d
ML_SERVICE_URL=http://localhost:8000
CORS_ORIGIN=http://localhost:19000
MAX_UPLOAD_SIZE=50MB
```

**Frontend** (`frontend/.env`):
```
REACT_APP_API_BASE_URL=http://localhost:3000/api
REACT_APP_ML_SERVICE_URL=http://localhost:8000
REACT_APP_ENV=development
```

## 📊 Monitoring & Logs

### View Logs

```bash
# ML Service logs
tail -f ml-service.log

# Backend logs
tail -f backend/backend.log

# PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*.log

# Frontend logs (in Expo console)
npm start  # Shows logs in terminal
```

### Health Checks

```bash
# Check all services
check_services() {
  echo "Checking ML Service..."
  curl -s http://localhost:8000/health > /dev/null && echo "✓ ML Service OK" || echo "✗ ML Service DOWN"
  
  echo "Checking Backend..."
  curl -s http://localhost:3000/api/health > /dev/null && echo "✓ Backend OK" || echo "✗ Backend DOWN"
  
  echo "Checking Database..."
  psql -U mindful_user -d mindfulme -c "SELECT 1" > /dev/null 2>&1 && echo "✓ Database OK" || echo "✗ Database DOWN"
}

check_services
```

## 🐛 Troubleshooting

### ML Service Issues

**Port 8000 Already in Use**:
```bash
# Find process using port
lsof -i :8000

# Kill it
kill -9 <PID>

# Or use different port
PORT=8001 python main.py
```

**Memory Issues**:
```bash
# Monitor memory usage
watch -n 1 'free -h'

# If insufficient, reduce model cache or run on GPU
export CUDA_VISIBLE_DEVICES=0  # Use GPU if available
```

**Model Download Failures**:
```bash
# Clear cache and retry
rm -rf ~/.cache/huggingface
pip install --upgrade transformers torch
python main.py
```

### Backend Issues

**Database Connection Failed**:
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Verify credentials
psql -U mindful_user -d mindfulme

# Check DATABASE_URL in .env
cat backend/.env | grep DATABASE_URL
```

**Port 3000 in Use**:
```bash
# Use different port
PORT=3001 npm start
```

### Frontend Issues

**Expo Connection Failed**:
```bash
# Clear Expo cache
rm -rf ~/.expo

# Restart Expo
npm start -- --clear

# Try tunnel connection
npm start -- --tunnel
```

**ML Service Not Found**:
```bash
# Check frontend can reach backend
curl -s http://localhost:3000/api/health

# Verify ML_SERVICE_URL in config.ts
cat frontend/src/utils/config.ts | grep ML_SERVICE_URL
```

## 🎓 Testing the Application

### Test User Registration & Login

```bash
# Create test user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "password":"TestPassword123!",
    "name":"Test User"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "password":"TestPassword123!"
  }'
```

### Test Sentiment Analysis

```bash
# Analyze text
curl -X POST http://localhost:8000/analyze/text \
  -H "Content-Type: application/json" \
  -d '{"text":"I am feeling anxious and overwhelmed"}'
```

### Test Voice Analysis

```bash
# Create test audio (5-second silence as WAV)
ffmpeg -f lavfi -i anullsrc=r=22050:cl=mono -t 5 -q:a 9 -acodec libmp3lame test.mp3
ffmpeg -i test.mp3 test.wav

# Analyze voice
curl -X POST http://localhost:8000/analyze/voice \
  -F "file=@test.wav"
```

## 📈 Performance Optimization

### ML Service
- **Model Caching**: Models are cached after first download
- **Batch Processing**: Use `/analyze/batch` for multiple texts
- **GPU Support**: Set `CUDA_VISIBLE_DEVICES=0` if GPU available

### Backend
- **Connection Pooling**: Configured in pool setup
- **Query Optimization**: Indexes on user_id, created_at
- **Caching**: Redis optional for session management

### Frontend
- **Lazy Loading**: Components load on demand
- **Image Optimization**: Audio data uses Blob storage
- **Network**: Requests debounced and cached

## 🔐 Production Deployment Notes

For production deployment:

1. **Environment Variables**: Use `.env.production`
2. **Database**: Use managed PostgreSQL service (AWS RDS, etc.)
3. **ML Service**: Consider containerization (Docker)
4. **Frontend**: Deploy via CI/CD (GitHub Actions, etc.)
5. **Security**: Enable HTTPS, set proper CORS, rate limiting
6. **Monitoring**: Use APM tools (DataDog, New Relic, etc.)

## ✅ Verification Checklist

Before using the application:

- [ ] PostgreSQL service is running
- [ ] ML Service responds to `/health`
- [ ] Backend responds to `/api/health`
- [ ] Frontend loads without errors
- [ ] Can create user account
- [ ] Can analyze text and voice
- [ ] Dashboard loads with data
- [ ] Medication tracking works
- [ ] Voice analysis shows results

## 📞 Support & Additional Resources

- **ML Service Docs**: [FastAPI Documentation](https://fastapi.tiangolo.com/)
- **Backend Docs**: [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- **Frontend Docs**: [React Native Documentation](https://reactnative.dev/)
- **Database**: [PostgreSQL Documentation](https://www.postgresql.org/docs/)

## 🎉 You're All Set!

If everything is running correctly, you should see:
- ✓ ML Service on `localhost:8000`
- ✓ Backend API on `localhost:3000`
- ✓ Frontend on `localhost:19000`
- ✓ PostgreSQL database synced

Start using MindfulMe! 🚀

---

**Last Updated**: January 20, 2026
**Version**: 1.0.0
