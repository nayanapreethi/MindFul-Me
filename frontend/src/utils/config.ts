// Environment Configuration
export const config = {
  API_BASE_URL: 'http://localhost:3000/api',
  ML_SERVICE_URL: 'http://localhost:8000',
  THEME: {
    PRIMARY_GRADIENT: ['#E0F2F1', '#B2DFDB', '#80CBC4'],
    ACCENT_COLOR: '#26A69A',
    DANGER_COLOR: '#EF5350',
    WARNING_COLOR: '#FFA726',
    SUCCESS_COLOR: '#66BB6A',
  },
  ML_ENDPOINTS: {
    HEALTH: '/health',
    ANALYZE_TEXT: '/analyze/text',
    ANALYZE_VOICE: '/analyze/voice',
    ANALYZE_REALTIME: '/analyze/realtime',
    PREDICT: '/predict',
    BATCH: '/analyze/batch',
  },
  SETTINGS: {
    REQUEST_TIMEOUT: 30000,
    MAX_RETRY_ATTEMPTS: 3,
    CACHE_DURATION_MS: 3600000,
    LOCAL_ONLY: true, // Enforce local-only requests
  },
};

export type MoodLog = {
  id: string;
  date: Date;
  moodScore: number;
  anxietyLevel: number;
  stressLevel: number;
  sleepQuality: number;
  mentalHealthIndex: number;
  activities: string[];
  note?: string;
};

export type JournalEntry = {
  id: string;
  date: Date;
  title: string;
  content: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  emotions: string[];
  stressLevel: number;
};

// ML Service types
export type SentimentAnalysisResult = {
  sentimentScore: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  emotions: Record<string, number>;
  keyPhrases: string[];
  insights: string[];
  isCrisis: boolean;
};

export type VoiceAnalysisResult = {
  pitchFeatures: Record<string, number>;
  jitterFeatures: Record<string, number>;
  shimmerFeatures: Record<string, number>;
  cadenceFeatures: Record<string, number>;
  intensityFeatures: Record<string, number>;
  flatAffectScore: number;
  agitatedSpeechScore: number;
  vocalHealthScore: number;
  durationSeconds: number;
  insights: string[];
  anomalies: string[];
};

export type PredictionResult = {
  burnoutRiskScore: number;
  anxietyTrendPrediction: Record<string, any>;
  moodTrendPrediction: Record<string, any>;
  proactiveInsights: Array<{ type: string; message: string; severity: 'high' | 'medium' | 'low' }>;
  confidence: number;
};

export const calculateMentalHealthIndex = (
  moodScore: number,
  anxietyLevel: number,
  stressLevel: number,
  sleepQuality: number,
  phq9Score: number = 5,
  gad7Score: number = 5
): number => {
  const mhi = 100 - (phq9Score * 2.0 + gad7Score * 2.0 + (10 - moodScore) * 3.0 + (10 - sleepQuality) * 1.5 + anxietyLevel * 1.5);
  return Math.max(0, Math.min(100, Math.round(mhi * 100) / 100));
};

export const analyzeSentiment = (text: string): { sentiment: 'positive' | 'neutral' | 'negative'; emotions: string[]; stressLevel: number } => {
  const lowerText = text.toLowerCase();
  const positiveWords = ['happy', 'good', 'great', 'wonderful', 'joyful', 'calm', 'peaceful', 'grateful'];
  const negativeWords = ['sad', 'bad', 'terrible', 'depressed', 'hopeless', 'anxious', 'worried', 'stressed', 'overwhelmed'];
  
  let positiveCount = positiveWords.filter(w => lowerText.includes(w)).length;
  let negativeCount = negativeWords.filter(w => lowerText.includes(w)).length;
  
  let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
  if (positiveCount > negativeCount + 1) sentiment = 'positive';
  else if (negativeCount > positiveCount + 1) sentiment = 'negative';
  
  const emotions: string[] = [];
  if (positiveCount > 0) emotions.push('joy');
  if (negativeCount > 0) emotions.push('sadness');
  if (lowerText.includes('stressed') || lowerText.includes('anxious')) emotions.push('stress');
  if (lowerText.includes('calm') || lowerText.includes('peaceful')) emotions.push('calm');
  if (emotions.length === 0) emotions.push('neutral');
  
  const stressLevel = Math.min(10, Math.max(0, 3 + (negativeCount > positiveCount ? 3 : 0)));
  
  return { sentiment, emotions, stressLevel };
};

export const generateMockMoodData = (days: number = 30): MoodLog[] => {
  const data: MoodLog[] = [];
  const now = new Date();
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    const baseScore = 6 + Math.sin(i / 7) * 1.5 + Math.random() * 0.5;
    const moodScore = Math.round(Math.max(1, Math.min(10, baseScore)));
    const anxietyLevel = Math.round(Math.max(0, Math.min(10, 4 + Math.sin(i / 5) * 2)));
    const stressLevel = Math.round(Math.max(0, Math.min(10, 3 + Math.cos(i / 4) * 2)));
    const sleepQuality = Math.round(Math.max(1, Math.min(10, 6 + Math.sin(i / 6) * 1.5)));
    const mentalHealthIndex = calculateMentalHealthIndex(moodScore, anxietyLevel, stressLevel, sleepQuality);
    
    data.push({
      id: `mood_${i}`,
      date,
      moodScore,
      anxietyLevel,
      stressLevel,
      sleepQuality,
      mentalHealthIndex,
      activities: ['Work', 'Exercise', 'Social'][Math.floor(Math.random() * 3)].split(','),
      note: '',
    });
  }
  
  return data;
};

// ML Service API utilities
export const mlService = {
  /**
   * Enforce localhost-only requests for security
   */
  validateUrl(url: string): boolean {
    if (!config.SETTINGS.LOCAL_ONLY) return true;
    const localhostPatterns = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];
    try {
      const urlObj = new URL(url);
      return localhostPatterns.some(pattern => urlObj.hostname.includes(pattern));
    } catch {
      return false;
    }
  },

  /**
   * Send request to ML service with validation
   */
  async request(endpoint: string, method: string = 'GET', data?: any): Promise<any> {
    const url = new URL(config.ML_SERVICE_URL + endpoint);
    
    if (!this.validateUrl(url.toString())) {
      throw new Error('Non-localhost requests are not allowed in local-only mode');
    }

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url.toString(), options);
      if (!response.ok) {
        throw new Error(`ML Service error: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('ML Service request failed:', error);
      throw error;
    }
  },

  /**
   * Analyze text for sentiment and emotions
   */
  async analyzeText(text: string): Promise<SentimentAnalysisResult> {
    return this.request(config.ML_ENDPOINTS.ANALYZE_TEXT, 'POST', { text });
  },

  /**
   * Real-time sentiment analysis for live typing
   */
  async analyzeRealtime(text: string): Promise<{ sentimentScore: number; sentiment: string }> {
    return this.request(config.ML_ENDPOINTS.ANALYZE_REALTIME, 'POST', { text });
  },

  /**
   * Analyze voice recording (requires FormData with file)
   */
  async analyzeVoice(audioFile: File): Promise<VoiceAnalysisResult> {
    const url = new URL(config.ML_SERVICE_URL + config.ML_ENDPOINTS.ANALYZE_VOICE);
    
    if (!this.validateUrl(url.toString())) {
      throw new Error('Non-localhost requests are not allowed');
    }

    const formData = new FormData();
    formData.append('file', audioFile);

    const response = await fetch(url.toString(), {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Voice analysis failed: ${response.statusText}`);
    }

    return await response.json();
  },

  /**
   * Get predictive insights
   */
  async getPrediction(moodLogs: any[], voiceBiometrics?: any[]): Promise<PredictionResult> {
    return this.request(config.ML_ENDPOINTS.PREDICT, 'POST', {
      userId: 'current', // Will be replaced with actual user ID
      moodLogs,
      voiceBiometrics,
    });
  },

  /**
   * Check ML service health
   */
  async checkHealth(): Promise<any> {
    return this.request(config.ML_ENDPOINTS.HEALTH);
  },
};

