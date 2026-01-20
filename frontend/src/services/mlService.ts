import axios from 'axios';
import CONFIG from '../utils/config';

// ML Service API client
const mlApi = axios.create({
  baseURL: CONFIG.ML_SERVICE_URL,
  timeout: 60000, // Longer timeout for ML operations
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types
export interface TextAnalysisResult {
  sentimentScore: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  emotions: Record<string, number>;
  keyPhrases: string[];
  insights: string[];
  isCrisis?: boolean;
}

export interface VoiceAnalysisResult {
  pitchFeatures: {
    mean: number;
    std: number;
    min: number;
    max: number;
    range: number;
    variability: number;
  };
  jitterFeatures: {
    mean: number;
    std: number;
    localJitter: number;
  };
  shimmerFeatures: {
    mean: number;
    std: number;
    localShimmer: number;
  };
  cadenceFeatures: {
    tempo: number;
    speechRate: number;
    rhythmRegularity: number;
    pauseRatio: number;
  };
  intensityFeatures: {
    mean: number;
    std: number;
    min: number;
    max: number;
    dynamicRange: number;
  };
  flatAffectScore: number;
  agitatedSpeechScore: number;
  vocalHealthScore: number;
  durationSeconds: number;
  insights: string[];
  anomalies: string[];
}

export interface PredictionResult {
  burnoutRiskScore: number;
  anxietyTrendPrediction: {
    trend: 'increasing' | 'decreasing' | 'stable';
    predictedValues: number[];
    confidence: number;
  };
  moodTrendPrediction: {
    trend: 'improving' | 'declining' | 'stable';
    predictedMood: number[];
    predictedMHI: number[];
    confidence: number;
  };
  proactiveInsights: Array<{
    type: string;
    severity: 'high' | 'medium' | 'low';
    message: string;
    recommendation: string;
    triggerValue: number;
  }>;
  confidence: number;
}

// ML Service API methods
export const mlService = {
  /**
   * Analyze text for sentiment and emotions
   */
  analyzeText: async (text: string): Promise<TextAnalysisResult> => {
    try {
      const response = await mlApi.post<TextAnalysisResult>('/analyze/text', { text });
      return response.data;
    } catch (error) {
      console.error('Text analysis error:', error);
      throw error;
    }
  },

  /**
   * Quick real-time sentiment analysis for live typing
   */
  analyzeRealtime: async (text: string): Promise<{ sentimentScore: number; sentiment: string }> => {
    try {
      const response = await mlApi.post('/analyze/realtime', { text });
      return response.data;
    } catch (error) {
      // Return neutral on error to not disrupt UX
      return { sentimentScore: 0.5, sentiment: 'neutral' };
    }
  },

  /**
   * Analyze voice recording for biometrics
   */
  analyzeVoice: async (audioFile: Blob): Promise<VoiceAnalysisResult> => {
    try {
      const formData = new FormData();
      formData.append('file', audioFile, 'recording.wav');

      const response = await mlApi.post<VoiceAnalysisResult>('/analyze/voice', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Voice analysis error:', error);
      throw error;
    }
  },

  /**
   * Get predictive insights based on user data
   */
  getPredictions: async (data: {
    userId: string;
    moodLogs: Array<{
      moodScore: number;
      mentalHealthIndex: number;
      anxietyLevel: number;
      stressLevel: number;
      sleepQuality: number;
      date: string;
    }>;
    voiceBiometrics?: Array<{
      flatAffectScore: number;
      agitatedSpeechScore: number;
      vocalHealthScore: number;
      date: string;
    }>;
    behavioralData?: Array<{
      sleepDurationHours: number;
      stepsCount: number;
      activeMinutes: number;
      date: string;
    }>;
  }): Promise<PredictionResult> => {
    try {
      const response = await mlApi.post<PredictionResult>('/predict', data);
      return response.data;
    } catch (error) {
      console.error('Prediction error:', error);
      throw error;
    }
  },

  /**
   * Batch analyze multiple texts
   */
  analyzeBatch: async (texts: string[]): Promise<{ results: (TextAnalysisResult | null)[] }> => {
    try {
      const response = await mlApi.post('/analyze/batch', texts);
      return response.data;
    } catch (error) {
      console.error('Batch analysis error:', error);
      throw error;
    }
  },

  /**
   * Check ML service health
   */
  healthCheck: async (): Promise<{
    status: string;
    timestamp: string;
    version: string;
    services: Record<string, string>;
  }> => {
    try {
      const response = await mlApi.get('/health');
      return response.data;
    } catch (error) {
      console.error('ML service health check failed:', error);
      throw error;
    }
  },
};

export default mlService;
