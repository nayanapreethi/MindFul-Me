# MindfulMe - Advanced Mental Health Ecosystem

**MindfulMe** is a privacy-centric mental health ecosystem that transitions from static mood tracking to **proactive emotional intelligence**. It utilizes a multi-modal approach—analyzing speech biomarkers, natural language journaling, and behavioral data—to calculate a comprehensive "Mental Health Index."

![MindfulMe](https://img.shields.io/badge/MindfulMe-v1.0.0-26A69A)
![React Native](https://img.shields.io/badge/React%20Native-0.73.2-61DAFB)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109.0-009688)
![Supabase](https://img.shields.io/badge/Supabase-Ready-3ECF8E)

---

## 🌟 Key Features

### 🔐 Secure Authentication
- **JWT-based authentication** with secure token management
- **Biometric support** (FaceID/TouchID) for seamless access
- **Password reset** with email verification

### 📊 Mental Health Index (MHI)
Comprehensive wellness scoring based on:
- PHQ-9 (Depression) and GAD-7 (Anxiety) assessments
- Daily mood tracking with AI sentiment analysis
- Sleep quality and behavioral correlations

### 📝 Smart Journaling
- **End-to-end encrypted** journal entries
- **DistilBERT sentiment analysis** for emotion detection
- **Real-time insights** as you write

### 🎤 Voice Biomarkers
- **MFCC analysis** for vocal特征 extraction
- **Pitch, jitter, shimmer** detection for stress indicators
- **Flat affect detection** for emotional state assessment

### 💊 Medication Adherence
- **Scheduled medication reminders**
- **Adherence tracking** with mood correlation
- **Push notifications** for timely check-ins

### 👨‍⚕️ Clinical Bridge
- **6-digit session codes** for secure therapist access
- **Time-limited, revocable** access tokens
- **Read-only dashboard** for healthcare providers

### 📈 Predictive Analytics
- **Burnout risk prediction** with 7-day forecasts
- **Trend analysis** with proactive wellness alerts
- **Random Forest ML model** for accurate predictions

---

## 🏗️ Technology Stack

### Frontend (React Native + Expo)
| Technology | Purpose |
|------------|---------|
| React Native 0.73 | Cross-platform mobile app |
| Victory-Native | Interactive charts & visualizations |
| Redux Toolkit | State management |
| React Navigation | Screen navigation |
| Supabase Client | Backend connectivity |

### Backend (Node.js + Express + TypeScript)
| Technology | Purpose |
|------------|---------|
| Express.js | REST API server |
| TypeScript | Type-safe development |
| JWT | Secure authentication |
| Supabase | Database & authentication |
| Zod | Runtime validation |

### ML Service (FastAPI + Python)
| Technology | Purpose |
|------------|---------|
| FastAPI | High-performance async API |
| Transformers | DistilBERT for sentiment analysis |
| Librosa | Audio feature extraction |
| scikit-learn | ML prediction models |

### Database (Supabase/PostgreSQL)
| Technology | Purpose |
|------------|---------|
| PostgreSQL | Relational database |
| Row Level Security | Data access control |
| Audit Logging | HIPAA compliance |

---

## 🚀 Quick Start

### Prerequisites
```bash
# Required versions
python3 --version  # 3.9+
node --version     # 18+
npm --version      # 9+
```

### Step 1: Setup Supabase
1. Create a project at [Supabase](https://supabase.com)
2. Follow [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for configuration
3. Copy your project URL and API keys

### Step 2: Configure Environment
```bash
# Backend environment
cd backend
cp .env.example .env
# Edit .env with your Supabase credentials

# Frontend environment
cd frontend
# Create .env with Supabase keys
echo "EXPO_PUBLIC_SUPABASE_URL=your_project_url" > .env
echo "EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key" >> .env
```

### Step 3: Install Dependencies

```bash
# ML Service
cd ml-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Backend
cd ../backend
npm install

# Frontend
cd ../frontend
npm install
```

### Step 4: Start Services

```bash
# Terminal 1: ML Service
cd ml-service
source venv/bin/activate
python main.py

# Terminal 2: Backend
cd backend
npm run dev

# Terminal 3: Frontend
cd frontend
npm start
```

### Step 5: Verify Installation
```bash
# ML Service Health
curl http://localhost:8000/health

# Backend Health
curl http://localhost:3000/api/health

# Open Expo Go on your mobile device
# Scan the QR code from terminal 3
```

---

## 📁 Project Structure

```
MindfulMe/
├── frontend/                 # React Native mobile app
│   ├── src/
│   │   ├── screens/         # App screens
│   │   │   ├── OnboardingScreen.tsx
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── IntakeFormScreen.tsx  # PHQ-9/GAD-7
│   │   │   ├── Dashboard.tsx
│   │   │   ├── JournalScreen.tsx
│   │   │   ├── MoodLogScreen.tsx
│   │   │   ├── VoiceJournalScreen.tsx
│   │   │   └── MedicationsScreen.tsx
│   │   ├── components/      # Reusable components
│   │   │   ├── PulseDashboard.tsx
│   │   │   └── ...
│   │   ├── services/        # API services
│   │   ├── store/           # Redux state
│   │   └── utils/           # Utilities
│   └── package.json
│
├── backend/                  # Node.js Express API
│   ├── src/
│   │   ├── routes/          # API routes
│   │   │   ├── auth.ts      # Authentication
│   │   │   ├── dashboard.ts # Mental Health Index
│   │   │   ├── journal.ts   # Journal entries
│   │   │   ├── voice.ts     # Voice analysis
│   │   │   ├── medication.ts
│   │   │   └── doctor.ts    # Clinical bridge
│   │   ├── middleware/      # Auth, errors, logging
│   │   ├── lib/             # Supabase client
│   │   └── index.ts         # Server entry
│   └── package.json
│
├── ml-service/               # Python FastAPI ML service
│   ├── app/
│   │   ├── services/
│   │   │   ├── sentiment_analysis.py
│   │   │   ├── voice_analysis.py
│   │   │   └── predictive_analysis.py
│   │   └── main.py          # API entry
│   ├── requirements.txt
│   └── ...
│
├── database/
│   └── schema.sql           # PostgreSQL schema
│
├── SUPABASE_SETUP.md         # Database setup guide
├── SETUP_GUIDE.md            # Full setup instructions
└── README.md
```

---

## 📊 Mental Health Index Formula

```
MHI = 100 - (PHQ-9 × 2 + GAD-7 × 2 + (10 - mood) × 3 + (10 - sleep) × 1.5 + anxiety × 1.5)
```

| Score Range | Classification |
|-------------|----------------|
| 80-100 | Excellent Mental Health |
| 60-79 | Good Mental Health |
| 40-59 | Fair Mental Health |
| 20-39 | Poor Mental Health |
| 0-19 | Critical - Seek Support |

---

## 🔒 Privacy & Security

- **End-to-end encryption** for sensitive data
- **Local ML processing** - data never leaves your device
- **HIPAA-compliant** audit logging
- **Supabase Row Level Security** for data isolation
- **Biometric authentication** option

---

## 🏥 Clinical Bridge

### For Patients
1. Go to Settings → Share with Doctor
2. Generate a 6-digit session code
3. Share code with your therapist
4. Code expires in 24 hours

### For Therapists
1. Enter patient's session code
2. View read-only Mental Health Index
3. Access mood trends and predictions
4. Export data for clinical notes

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## 📝 License

MIT License - See [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [DistilBERT](https://huggingface.co/distilbert-base-uncased) for sentiment analysis
- [Librosa](https://librosa.org/) for audio analysis
- [Supabase](https://supabase.com/) for backend infrastructure
- [Victory-Native](https://formidable.com/open-source/victory/) for charts

---

**MindfulMe** - *Your journey to mental wellness starts here* 🧘

