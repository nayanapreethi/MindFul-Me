# MindfulMe Quick Reference Guide

**Fast setup and command reference for MindfulMe local-AI mental health tracker.**

## 🚀 Quick Start (5 minutes)

### Prerequisites Check
```bash
python3 --version      # Should be 3.9+
node --version         # Should be 18+
psql --version        # Should be 12+
npm --version         # Should be 9+
```

### One-Command Setup
```bash
# Create database
sudo -u postgres psql << EOF
CREATE DATABASE mindfulme;
CREATE USER mindful_user WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE mindfulme TO mindful_user;
\q
EOF

# Initialize database schema
psql -U mindful_user -d mindfulme -f database/schema.sql
```

## 📡 Starting Services

### Terminal 1: ML Service (Port 8000)
```bash
cd ml-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

### Terminal 2: Backend (Port 3000)
```bash
cd backend
npm install
export DATABASE_URL="postgresql://mindful_user:password@localhost:5432/mindfulme"
npm start
```

### Terminal 3: Frontend (Port 19000)
```bash
cd frontend
npm install
npm start
```

## 🔗 Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| ML Service | `http://localhost:8000` | Text/voice analysis & predictions |
| Backend API | `http://localhost:3000/api` | Data & authentication |
| Frontend | `http://localhost:19000` | React Native app |
| Database | `localhost:5432` | PostgreSQL |

## ✅ Health Checks

```bash
# Check all services
curl http://localhost:8000/health    # ML Service
curl http://localhost:3000/api/health # Backend
psql -U mindful_user -d mindfulme -c "SELECT 1"  # Database
```

Expected responses: All should return `200 OK`

## 🔌 API Quick Reference

### ML Service Endpoints

**Analyze Text**
```bash
curl -X POST http://localhost:8000/analyze/text \
  -H "Content-Type: application/json" \
  -d '{"text":"I feel great today!"}'
```

**Analyze Voice**
```bash
curl -X POST http://localhost:8000/analyze/voice \
  -F "file=@audio.wav"
```

**Get Predictions**
```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"user123",
    "moodLogs":[{"date":"2026-01-20","mentalHealthIndex":65}],
    "voiceBiometrics":[]
  }'
```

### Backend API Endpoints

**Create Journal Entry**
```bash
curl -X POST http://localhost:3000/api/journal \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"My Day","content":"Text here"}'
```

**Upload Voice**
```bash
curl -X POST http://localhost:3000/api/voice/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "audio=@recording.wav"
```

**Log Medication**
```bash
curl -X POST http://localhost:3000/api/medication/:id/log \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"taken","actualTime":"2026-01-20T09:00:00"}'
```

## 📊 Frontend Integration

### Using ML Service
```typescript
import { mlService } from './utils/config';

// Text analysis
const sentiment = await mlService.analyzeText("I feel anxious");

// Voice analysis
const voiceResult = await mlService.analyzeVoice(audioFile);

// Predictions
const burnout = await mlService.getPrediction(moodLogs);
```

### Using PulseDashboard
```typescript
import PulseDashboard from './components/PulseDashboard';

<PulseDashboard userId="user123" onNavigate={handleNav} />
```

## 🛑 Stop Services

```bash
# Stop all with Ctrl+C in each terminal

# Or kill processes
pkill -f "python main.py"      # ML Service
pkill -f "npm start"            # Backend & Frontend
sudo systemctl stop postgresql  # Database
```

## 📝 Common Tasks

### Add New User
```sql
-- In PostgreSQL
INSERT INTO users (id, email, password_hash, name) 
VALUES (gen_random_uuid(), 'user@example.com', 'hashed_pw', 'Name');
```

### Clear Database
```bash
psql -U mindful_user -d mindfulme << EOF
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
\q
EOF
psql -U mindful_user -d mindfulme -f database/schema.sql
```

### View Logs
```bash
# ML Service
tail -f ml-service.log

# Backend
tail -f backend.log

# Database
sudo tail -f /var/log/postgresql/postgresql-*.log
```

### Test ML Models
```python
# In Python REPL
from transformers import pipeline
sentiment = pipeline('sentiment-analysis')
print(sentiment("I feel great!"))

import librosa
y, sr = librosa.load('test.wav')
print(f"Duration: {librosa.get_duration(y=y, sr=sr)}s")
```

## 🔍 Troubleshooting

| Issue | Solution |
|-------|----------|
| Port already in use | `lsof -i :PORT` then `kill -9 PID` |
| ML models not downloading | `rm -rf ~/.cache/huggingface` then restart |
| Database connection failed | `psql -U mindful_user -d mindfulme` to verify |
| Frontend can't reach ML service | Check `config.ts` has `localhost:8000` |
| Permission denied on scripts | `chmod +x script.sh` |
| Python venv issues | `rm -rf venv && python3 -m venv venv && source venv/bin/activate` |

## 📚 Key Files Reference

```
MindFul Me/
├── ml-service/main.py                 # FastAPI server
├── backend/src/index.ts               # Express server
├── frontend/src/App.tsx               # React entry point
├── frontend/src/components/
│   ├── Dashboard.tsx                  # Original dashboard
│   └── PulseDashboard.tsx            # New ML-powered dashboard
├── frontend/src/utils/config.ts       # ML service config
├── database/schema.sql                # Database schema
└── [documentation guides]
```

## 🎯 Performance Tips

- **Faster ML inference**: Clear cache between runs
- **Reduce memory**: Limit model workers in ML service
- **Database speed**: Index frequently queried columns
- **Network**: Use tunnel for Expo if local network fails

## 🔐 Security Checklist

- [ ] JWT_SECRET changed from default
- [ ] Database password set to strong value
- [ ] CORS restricted to localhost
- [ ] No external API calls
- [ ] SSL/TLS for production deployment
- [ ] Environment variables in .env file

## 📞 Getting Help

1. Check logs: `tail -f *.log`
2. Verify services: `curl http://localhost:PORT/health`
3. Review documentation: `ML_IMPLEMENTATION.md`
4. Check database: `psql -U mindful_user -d mindfulme`
5. Test ML service directly: curl examples above

## ⚡ Command Shortcuts

```bash
# Create convenient aliases
alias ml-start="cd ml-service && source venv/bin/activate && python main.py"
alias be-start="cd backend && npm start"
alias fe-start="cd frontend && npm start"
alias db-check="psql -U mindful_user -d mindfulme -c 'SELECT 1'"
alias all-status="curl http://localhost:8000/health && curl http://localhost:3000/api/health && db-check"
```

## 📊 System Requirements

- **RAM**: 8GB minimum (4GB for ML models, 2GB for services)
- **CPU**: 2+ cores recommended
- **Storage**: 5GB for ML models and cache
- **Network**: Localhost connection (no internet needed)

## 🎓 Learning Path

1. Start with **COMPLETE_SETUP.md** - Full installation guide
2. Read **ML_IMPLEMENTATION.md** - Understanding ML features
3. Review **API_INTEGRATION_GUIDE.md** - Integration examples
4. Explore **IMPLEMENTATION_COMPLETE.md** - What was built

---

**For detailed guides, see documentation files:**
- `COMPLETE_SETUP.md` - Full setup instructions
- `ML_IMPLEMENTATION.md` - ML service details
- `API_INTEGRATION_GUIDE.md` - Integration examples
- `IMPLEMENTATION_COMPLETE.md` - Complete feature list

**Last Updated**: January 20, 2026
**Version**: 1.0.0
