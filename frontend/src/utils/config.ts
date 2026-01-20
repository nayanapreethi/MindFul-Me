// Environment Configuration
export const CONFIG = {
  API_URL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',
  ML_SERVICE_URL: process.env.EXPO_PUBLIC_ML_SERVICE_URL || 'http://localhost:8000',
  
  // JWT Configuration
  JWT: {
    ACCESS_TOKEN_EXPIRY: '15m',
    REFRESH_TOKEN_EXPIRY: '7d',
  },
  
  // Biometric Configuration
  BIOMETRICS: {
    enabled: true,
    promptMessage: 'Authenticate to access MindfulMe',
    cancelButtonText: 'Cancel',
  },
  
  // Encryption Configuration
  ENCRYPTION: {
    algorithm: 'AES-256-GCM',
    keyLength: 256,
  },
  
  // Feature Flags
  FEATURES: {
    voiceJournal: true,
    textJournal: true,
    behavioralSync: true,
    predictiveDashboard: true,
    doctorPortal: true,
    medicationTracker: true,
  },
  
  // Chart Configuration
  CHARTS: {
    defaultDays: 7,
    maxDays: 30,
    alertThreshold: 20, // 20% decline
  },
  
  // Accessibility
  ACCESSIBILITY: {
    fontSizeMultiplier: 1,
    highContrast: false,
    screenReaderOptimized: false,
  },
};

export default CONFIG;

