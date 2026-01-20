# MindfulMe - Mental Health Platform Setup Guide

A complete guide to running the MindfulMe Mental Health Platform with multi-modal AI.

## Prerequisites

- **Node.js** v18 or higher
- **Python** 3.10 or higher
- **PostgreSQL** 14 or higher
- **Redis** 7 or higher
- **Git** for version control

---

## Step 1: Database Setup

### Install PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**macOS (using Homebrew):**
```bash
brew install postgresql
brew services start postgresql
```

**Windows:**
Download from https://www.postgresql.org/download/windows/

### Create Database and User

```bash
sudo -u postgres psql

# In PostgreSQL console:
CREATE DATABASE mindfulme;
CREATE USER mindfulme_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE mindfulme TO mindfulme_user;
ALTER USER mindfulme_user WITH SUPERUSER;
\q
```

### Run Database Schema

```bash
psql -U mindfulme_user -d mindfulme -f database/schema.sql
```

---

## Step 2: Redis Setup (Optional - for caching)

**Ubuntu/Debian:**
```bash
sudo apt install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

**macOS:**
```bash
brew install redis
brew services start redis
```

---

## Step 3: Backend Setup

### Navigate to Backend Directory
```bash
cd backend
```

### Install Dependencies
```bash
npm install
```

### Configure Environment Variables
```bash
cp .env.example .env
```

Edit `.env` file with your settings:
```env
# Database
DATABASE_URL=postgresql://mindfulme_user:your_password@localhost:5432/mindfulme

# JWT Secrets (generate secure random strings)
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-token-secret-change-in-production

# Encryption Key (32 bytes hex)
ENCRYPTION_KEY=your-32-byte-encryption-key-here!!!

# Server
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:8081

# Redis (if using)
REDIS_URL=redis://localhost:6379

# ML Service URL
ML_SERVICE_URL=http://localhost:8000
```

### Run Backend Development Server
```bash
npm run dev
```

Backend will be running at: **http://localhost:3000**

---

## Step 4: ML Service Setup

### Navigate to ML Service Directory
```bash
cd ml-service
```

### Create Python Virtual Environment
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### Install Python Dependencies
```bash
pip install -r requirements.txt
```

### Run ML Service
```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

ML Service will be running at: **http://localhost:8000**

### Verify ML Service
```bash
curl http://localhost:8000/health
# Expected response: {"status":"healthy","timestamp":"..."}
```

---

## Step 5: Frontend Setup (React Native)

### Prerequisites
- iOS: macOS with Xcode
- Android: Android Studio with SDK

### Navigate to Frontend Directory
```bash
cd frontend
```

### Install Dependencies
```bash
npm install
```

### iOS Setup (macOS only)
```bash
cd ios
pod install
cd ..
```

### Run on iOS Simulator
```bash
npx react-native run-ios
```

### Run on Android Emulator
```bash
# Make sure Android emulator is running
npx react-native run-android
```

---

## Step 6: Verify All Services

### Test Backend Health
```bash
curl http://localhost:3000/health
# Expected: {"status":"healthy","timestamp":"...","version":"1.0.0"}
```

### Test ML Service
```bash
curl http://localhost:8000/health
# Expected: {"status":"healthy","timestamp":"..."}
```

### Test Text Analysis API
```bash
curl -X POST http://localhost:8000/analyze/text \
  -H "Content-Type: application/json" \
  -d '{"text":"I am feeling happy and peaceful today"}'
```

---

## Project Structure

```
MindfulMe/
├── backend/                    # Node.js Express API
│   ├── src/
│   │   ├── index.ts           # Server entry point
│   │   ├── config.ts          # Configuration
│   │   ├── middleware/        # Auth & error handling
│   │   ├── routes/            # API routes
│   │   └── services/          # Business logic
│   └── package.json
│
├── frontend/                   # React Native App
│   ├── src/
│   │   ├── components/        # UI components
│   │   ├── services/          # API clients
│   │   ├── store/             # State management
│   │   └── utils/             # Helpers
│   └── package.json
│
├── ml-service/                 # Python FastAPI ML Service
│   ├── main.py                # API entry point
│   └── requirements.txt       # Python dependencies
│
└── database/
    └── schema.sql             # PostgreSQL schema
```

---

## Available API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | User login |
| POST | /api/auth/refresh | Refresh tokens |
| POST | /api/auth/logout | Logout |
| GET | /api/auth/me | Get current user |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/dashboard/overview | Dashboard data |
| GET | /api/dashboard/chart | Chart data |
| POST | /api/dashboard/mood | Log mood entry |

### ML Service
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /analyze/text | Text sentiment analysis |
| POST | /analyze/voice | Voice biometrics analysis |
| POST | /predict | Predictive analytics |

---

## Environment Variables Reference

### Backend (.env)
| Variable | Description | Default |
|----------|-------------|---------|
| DATABASE_URL | PostgreSQL connection string | Required |
| JWT_SECRET | JWT signing secret | Required |
| JWT_REFRESH_SECRET | Refresh token secret | Required |
| ENCRYPTION_KEY | AES-256 encryption key | Required |
| PORT | Server port | 3000 |
| ML_SERVICE_URL | ML service URL | http://localhost:8000 |

### Frontend (frontend/src/utils/config.ts)
| Setting | Description | Default |
|---------|-------------|---------|
| API_BASE_URL | Backend API URL | http://localhost:3000/api |
| ML_SERVICE_URL | ML service URL | http://localhost:8000 |
| FEATURES | Feature flags | All enabled |

---

## Troubleshooting

### Port Already in Use
```bash
# Find process using port
lsof -i :3000
lsof -i :8000

# Kill process
kill -9 <PID>
```

### Database Connection Issues
- Ensure PostgreSQL is running
- Verify DATABASE_URL format
- Check firewall settings

### ML Service Import Errors
```bash
# Recreate virtual environment
deactivate
rm -rf venv
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### React Native Build Errors
```bash
# Clear cache and reinstall
cd frontend
rm -rf node_modules package-lock.json
npm install
cd ios && rm -rf Pods Podfile.lock
pod install
cd ..
npx react-native start --reset-cache
```

---

## Next Steps

1. **Set up Supabase** for production database
2. **Configure S3** for file storage
3. **Set up error tracking** (Sentry)
4. **Configure CI/CD** pipeline
5. **Add unit tests** for all services

---

## License

MIT

