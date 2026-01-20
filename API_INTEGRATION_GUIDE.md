# MindfulMe API Integration Guide

Complete examples for integrating MindfulMe ML services with the backend and frontend.

## 🔌 ML Service Integration Examples

### 1. Text Sentiment Analysis Integration

#### Frontend Implementation

```typescript
// frontend/src/services/sentimentService.ts
import { mlService, SentimentAnalysisResult } from '../utils/config';

export class SentimentService {
  /**
   * Analyze journal entry for sentiment and emotions
   */
  static async analyzeJournalEntry(text: string): Promise<SentimentAnalysisResult> {
    try {
      const result = await mlService.analyzeText(text);
      return result;
    } catch (error) {
      console.error('Sentiment analysis failed:', error);
      throw error;
    }
  }

  /**
   * Real-time analysis for live typing
   */
  static async analyzeRealtime(text: string): Promise<{ sentimentScore: number; sentiment: string }> {
    if (text.length < 3) {
      return { sentimentScore: 0.5, sentiment: 'neutral' };
    }
    return mlService.analyzeRealtime(text);
  }

  /**
   * Display sentiment indicators
   */
  static getSentimentIcon(sentiment: string): string {
    switch (sentiment) {
      case 'positive':
        return '😊';
      case 'negative':
        return '😟';
      default:
        return '😐';
    }
  }

  /**
   * Get emotion colors for UI
   */
  static getEmotionColor(emotion: string): string {
    const colorMap: Record<string, string> = {
      joy: '#66BB6A',
      sadness: '#42A5F5',
      anger: '#EF5350',
      fear: '#AB47BC',
      surprise: '#FFA726',
      disgust: '#8D6E63',
      neutral: '#90A4AE',
    };
    return colorMap[emotion] || '#90A4AE';
  }
}
```

#### Backend Route Implementation

```typescript
// backend/src/routes/journal.ts
import { Router, Request, Response } from 'express';
import axios from 'axios';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

/**
 * POST /api/journal
 * Create a journal entry with sentiment analysis
 */
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { title, content } = req.body;

    // Analyze content using ML service
    const sentimentAnalysis = await axios.post(
      `${ML_SERVICE_URL}/analyze/text`,
      { text: content },
      { timeout: 30000 }
    );

    const { sentiment, emotions, keyPhrases, insights, isCrisis } = sentimentAnalysis.data;

    // Store in database
    const result = await pool.query(
      `INSERT INTO journal_entries (user_id, title, content, sentiment, emotions, key_phrases, insights, is_crisis)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, created_at`,
      [
        userId,
        title,
        content,
        sentiment,
        JSON.stringify(emotions),
        JSON.stringify(keyPhrases),
        JSON.stringify(insights),
        isCrisis,
      ]
    );

    res.status(201).json({
      id: result.rows[0].id,
      sentiment,
      emotions,
      keyPhrases,
      insights,
      isCrisis,
      createdAt: result.rows[0].created_at,
    });
  })
);

export default router;
```

#### Usage in React Component

```typescript
// frontend/src/components/JournalEntry.tsx
import React, { useState, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, Text } from 'react-native';
import { SentimentService } from '../services/sentimentService';

export function JournalEntry() {
  const [text, setText] = useState('');
  const [sentiment, setSentiment] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleTextChange = useCallback(
    async (newText: string) => {
      setText(newText);

      // Real-time sentiment analysis
      if (newText.length > 3) {
        try {
          const realtimeSentiment = await SentimentService.analyzeRealtime(newText);
          setSentiment(realtimeSentiment);
        } catch (error) {
          console.error('Real-time analysis failed:', error);
        }
      }
    },
    []
  );

  const handleSave = async () => {
    try {
      setLoading(true);
      const result = await SentimentService.analyzeJournalEntry(text);
      setSentiment(result);

      // Show analysis results
      Alert.alert('Analysis Complete', `Sentiment: ${result.sentiment}\nEmotions: ${Object.keys(result.emotions).join(', ')}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to analyze entry');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <TextInput
        value={text}
        onChangeText={handleTextChange}
        placeholder="Write your thoughts..."
        multiline
        numberOfLines={8}
      />

      {sentiment && (
        <View>
          <Text>{SentimentService.getSentimentIcon(sentiment.sentiment)}</Text>
          <Text>Sentiment: {sentiment.sentiment}</Text>
        </View>
      )}

      <TouchableOpacity onPress={handleSave} disabled={loading}>
        <Text>{loading ? 'Analyzing...' : 'Save Entry'}</Text>
      </TouchableOpacity>
    </View>
  );
}
```

### 2. Voice Analysis Integration

#### Frontend Implementation

```typescript
// frontend/src/services/voiceService.ts
import { mlService, VoiceAnalysisResult } from '../utils/config';

export class VoiceService {
  /**
   * Analyze recorded audio
   */
  static async analyzeAudio(audioFile: File): Promise<VoiceAnalysisResult> {
    try {
      const result = await mlService.analyzeVoice(audioFile);
      return result;
    } catch (error) {
      console.error('Voice analysis failed:', error);
      throw error;
    }
  }

  /**
   * Get vocal health indicators
   */
  static getVocalHealthStatus(score: number): { label: string; color: string } {
    if (score >= 80) return { label: 'Excellent', color: '#66BB6A' };
    if (score >= 60) return { label: 'Good', color: '#8BC34A' };
    if (score >= 40) return { label: 'Fair', color: '#FFA726' };
    return { label: 'Poor', color: '#EF5350' };
  }

  /**
   * Get flat affect interpretation
   */
  static getFlatAffectInterpretation(score: number): string {
    if (score > 0.7) return 'Low emotional expression detected';
    if (score > 0.5) return 'Reduced emotional expression';
    return 'Normal emotional expression';
  }

  /**
   * Get agitated speech interpretation
   */
  static getAgitatedSpeechInterpretation(score: number): string {
    if (score > 0.7) return 'High stress indicators detected';
    if (score > 0.5) return 'Some stress indicators present';
    return 'Normal speech patterns';
  }
}
```

#### Backend Route Implementation

```typescript
// backend/src/routes/voice.ts - Enhanced
import { Router, Request, Response } from 'express';
import axios from 'axios';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /api/voice/analyze
 * Analyze voice recording
 */
router.post(
  '/analyze',
  authenticate,
  upload.single('audio'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    if (!req.file) {
      return res.status(400).json({ error: 'Audio file required' });
    }

    // Forward to ML service
    const formData = new FormData();
    formData.append('file', new Blob([req.file.buffer]), 'audio.wav');

    const mlResponse = await axios.post(`${ML_SERVICE_URL}/analyze/voice`, formData, {
      headers: formData.getHeaders?.(),
    });

    const analysis = mlResponse.data;

    // Store analysis in database
    const result = await pool.query(
      `INSERT INTO voice_biometrics 
       (user_id, pitch_features, cadence_features, flat_affect_score, 
        agitated_speech_score, overall_vocal_health_score, recording_duration_seconds)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, overall_vocal_health_score`,
      [
        userId,
        JSON.stringify(analysis.pitchFeatures),
        JSON.stringify(analysis.cadenceFeatures),
        analysis.flatAffectScore,
        analysis.agitatedSpeechScore,
        analysis.vocalHealthScore,
        analysis.durationSeconds,
      ]
    );

    res.json({
      id: result.rows[0].id,
      vocalHealthScore: result.rows[0].overall_vocal_health_score,
      analysis,
    });
  })
);

export default router;
```

#### React Component for Voice Recording

```typescript
// frontend/src/components/VoiceJournal.tsx
import React, { useState } from 'react';
import { View, TouchableOpacity, Text, ActivityIndicator, Alert } from 'react-native';
import { VoiceService } from '../services/voiceService';
import { Audio } from 'expo-av';

export function VoiceJournal() {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<any>(null);

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.granted) {
        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        await recording.startAsync();
        setRecording(recording);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopAndAnalyze = async () => {
    try {
      if (!recording) return;

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      if (uri) {
        setAnalyzing(true);

        // Convert to file
        const audioFile = new File([await fetch(uri).then(r => r.blob())], 'voice.wav', {
          type: 'audio/wav',
        });

        // Analyze
        const analysis = await VoiceService.analyzeAudio(audioFile);
        setResults(analysis);

        // Display results
        const healthStatus = VoiceService.getVocalHealthStatus(analysis.vocalHealthScore);
        Alert.alert(
          'Voice Analysis Complete',
          `Health Score: ${analysis.vocalHealthScore}/100 (${healthStatus.label})\n${analysis.insights.join('\n')}`
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to analyze voice');
    } finally {
      setRecording(null);
      setAnalyzing(false);
    }
  };

  return (
    <View>
      <TouchableOpacity onPress={recording ? stopAndAnalyze : startRecording}>
        <Text>{recording ? '⏹ Stop & Analyze' : '🎤 Start Recording'}</Text>
      </TouchableOpacity>

      {analyzing && <ActivityIndicator />}

      {results && (
        <View>
          <Text>Vocal Health Score: {results.vocalHealthScore}</Text>
          <Text>Duration: {results.durationSeconds}s</Text>
          {results.insights.map((insight: string, idx: number) => (
            <Text key={idx}>• {insight}</Text>
          ))}
        </View>
      )}
    </View>
  );
}
```

### 3. Predictive Analysis Integration

#### Backend Implementation

```typescript
// backend/src/routes/dashboard.ts - Enhanced
import { Router, Request, Response } from 'express';
import axios from 'axios';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

/**
 * GET /api/dashboard/predictions
 * Get predictive insights for user
 */
router.get(
  '/predictions',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const days = parseInt(req.query.days as string) || 30;

    // Fetch mood logs from database
    const moodResult = await pool.query(
      `SELECT mood_score, anxiety_level, stress_level, sleep_quality, created_at
       FROM mood_logs
       WHERE user_id = $1 AND created_at >= CURRENT_DATE - INTERVAL $2 days
       ORDER BY created_at DESC`,
      [userId, days]
    );

    const moodLogs = moodResult.rows.map(row => ({
      date: row.created_at.toISOString(),
      moodScore: row.mood_score,
      anxietyLevel: row.anxiety_level,
      stressLevel: row.stress_level,
      sleepQuality: row.sleep_quality,
    }));

    // Fetch voice biometrics
    const voiceResult = await pool.query(
      `SELECT overall_vocal_health_score, flat_affect_score, agitated_speech_score, created_at
       FROM voice_biometrics
       WHERE user_id = $1 AND created_at >= CURRENT_DATE - INTERVAL $2 days
       ORDER BY created_at DESC`,
      [userId, days]
    );

    const voiceBiometrics = voiceResult.rows.map(row => ({
      vocalHealthScore: row.overall_vocal_health_score,
      flatAffectScore: row.flat_affect_score,
      agitatedSpeechScore: row.agitated_speech_score,
    }));

    // Get predictions from ML service
    const prediction = await axios.post(
      `${ML_SERVICE_URL}/predict`,
      {
        userId,
        moodLogs,
        voiceBiometrics,
      },
      { timeout: 30000 }
    );

    res.json(prediction.data);
  })
);

export default router;
```

#### Frontend Dashboard Integration

```typescript
// frontend/src/components/PredictiveInsights.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { VictoryChart, VictoryLine, VictoryAxis } from 'victory-native';
import { config, mlService, PredictionResult } from '../utils/config';

export function PredictiveInsights() {
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPredictions();
  }, []);

  const loadPredictions = async () => {
    try {
      setLoading(true);

      // Fetch from backend (which calls ML service)
      const response = await fetch(`${config.API_BASE_URL}/dashboard/predictions`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      const data = await response.json();
      setPrediction(data);

      // Show alert if burnout risk is high
      if (data.burnoutRiskScore > 0.7) {
        Alert.alert(
          'High Burnout Risk',
          'Consider prioritizing self-care and seeking support.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Failed to load predictions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !prediction) {
    return <Text>Loading predictions...</Text>;
  }

  const moodForecast = prediction.moodTrendPrediction.forecast || [];

  return (
    <ScrollView>
      {/* Burnout Risk */}
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Burnout Risk Score</Text>
        <Text style={{ fontSize: 24 }}>{(prediction.burnoutRiskScore * 100).toFixed(0)}%</Text>
        <Text>Confidence: {(prediction.confidence * 100).toFixed(0)}%</Text>
      </View>

      {/* Proactive Insights */}
      {prediction.proactiveInsights.length > 0 && (
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Wellness Recommendations</Text>
          {prediction.proactiveInsights.map((insight, idx) => (
            <Text key={idx} style={{ marginVertical: 8 }}>
              {insight.message}
            </Text>
          ))}
        </View>
      )}

      {/* Mood Forecast Chart */}
      {moodForecast.length > 0 && (
        <VictoryChart width={400} height={250}>
          <VictoryAxis />
          <VictoryAxis dependentAxis domain={[0, 100]} />
          <VictoryLine data={moodForecast.map((v, i) => ({ x: i, y: v }))} />
        </VictoryChart>
      )}
    </ScrollView>
  );
}
```

## 📡 Complete Flow Examples

### User Journey: Journaling with Analysis

```
1. User opens journal entry screen
   ↓
2. Types entry → Real-time sentiment analysis (frontend calls ML)
   ↓
3. Clicks save → Full sentiment analysis (backend calls ML)
   ↓
4. Results stored in database
   ↓
5. Dashboard updated with new sentiment data
   ↓
6. Predictive model recalculates burnout risk
   ↓
7. User sees insights in Pulse Dashboard
```

### User Journey: Voice Journal

```
1. User opens voice journal
   ↓
2. Records audio → Saved locally
   ↓
3. Stops recording → Sent to backend
   ↓
4. Backend forwards to ML service
   ↓
5. ML service analyzes vocal features
   ↓
6. Results stored in database
   ↓
7. Frontend displays vocal health score and insights
   ↓
8. Voice metrics feed into burnout prediction
```

## 🔒 Error Handling

```typescript
// Comprehensive error handling
export async function safeMLRequest<T>(
  fn: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error('ML Service request failed:', error);

    // Log error for debugging
    logAnalytics('ml_service_error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });

    // Return fallback or mock data
    return fallback;
  }
}

// Usage
const sentiment = await safeMLRequest(
  () => mlService.analyzeText(text),
  { sentiment: 'neutral', sentimentScore: 0 }
);
```

## 🎯 Best Practices

1. **Batch Requests**: Use `/analyze/batch` for multiple entries
2. **Caching**: Cache results locally to reduce network calls
3. **Error Recovery**: Implement fallbacks for ML service failures
4. **Rate Limiting**: Limit requests to prevent overload
5. **Logging**: Log all ML service interactions for debugging
6. **Monitoring**: Track response times and error rates

---

**For more examples and advanced usage**, refer to the main implementation files in your project.
