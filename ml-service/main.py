"""
MindfulMe ML Service
FastAPI-based service for voice and text analysis
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import uvicorn
import os
from datetime import datetime
import tempfile
import numpy as np

# Import analysis services
from app.services.voice_analysis import VoiceAnalyzer
from app.services.sentiment_analysis import SentimentAnalyzer
from app.services.predictive_analysis import PredictiveAnalyzer

# Initialize FastAPI app
app = FastAPI(
    title="MindfulMe ML Service",
    description="Voice and Text Analysis API for Mental Health Platform",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize analyzers
voice_analyzer = VoiceAnalyzer()
sentiment_analyzer = SentimentAnalyzer()
predictive_analyzer = PredictiveAnalyzer()


# Request/Response Models
class TextAnalysisRequest(BaseModel):
    text: str


class TextAnalysisResponse(BaseModel):
    sentimentScore: float
    sentiment: str
    emotions: Dict[str, float]
    keyPhrases: List[str]
    insights: List[str]


class VoiceAnalysisResponse(BaseModel):
    pitchFeatures: Dict[str, Any]
    jitterFeatures: Dict[str, Any]
    shimmerFeatures: Dict[str, Any]
    cadenceFeatures: Dict[str, Any]
    intensityFeatures: Dict[str, Any]
    flatAffectScore: float
    agitatedSpeechScore: float
    vocalHealthScore: float
    durationSeconds: float
    insights: List[str]
    anomalies: List[str]


class PredictionRequest(BaseModel):
    userId: str
    moodLogs: List[Dict[str, Any]]
    voiceBiometrics: Optional[List[Dict[str, Any]]] = None
    behavioralData: Optional[List[Dict[str, Any]]] = None


class PredictionResponse(BaseModel):
    burnoutRiskScore: float
    anxietyTrendPrediction: Dict[str, Any]
    moodTrendPrediction: Dict[str, Any]
    proactiveInsights: List[Dict[str, Any]]
    confidence: float


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str
    services: Dict[str, str]


# Health check endpoint
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow().isoformat(),
        version="1.0.0",
        services={
            "voice_analysis": "ready",
            "sentiment_analysis": "ready",
            "predictive_analysis": "ready",
        }
    )


# Text Analysis endpoint
@app.post("/analyze/text", response_model=TextAnalysisResponse)
async def analyze_text(request: TextAnalysisRequest):
    """
    Analyze text for sentiment and emotional content
    
    Uses RoBERTa-based sentiment analysis and emotion detection
    """
    try:
        if not request.text or len(request.text.strip()) == 0:
            raise HTTPException(status_code=400, detail="Text content is required")
        
        result = sentiment_analyzer.analyze(request.text)
        return TextAnalysisResponse(**result)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


# Voice Analysis endpoint
@app.post("/analyze/voice", response_model=VoiceAnalysisResponse)
async def analyze_voice(file: UploadFile = File(...)):
    """
    Analyze voice recording for vocal biometrics
    
    Extracts pitch, jitter, shimmer, cadence, and intensity features
    Detects flat affect and agitated speech patterns
    """
    try:
        # Validate file type
        allowed_types = ["audio/wav", "audio/mpeg", "audio/mp3", "audio/webm", "audio/ogg"]
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}"
            )
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_path = temp_file.name
        
        try:
            # Analyze voice
            result = voice_analyzer.analyze(temp_path)
            return VoiceAnalysisResponse(**result)
        finally:
            # Clean up temp file
            if os.path.exists(temp_path):
                os.remove(temp_path)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voice analysis failed: {str(e)}")


# Predictive Analysis endpoint
@app.post("/predict", response_model=PredictionResponse)
async def predict_trends(request: PredictionRequest):
    """
    Generate predictive insights based on user data
    
    Uses LSTM/Random Forest models for trend prediction
    Triggers proactive wellness alerts on 20% decline
    """
    try:
        if not request.moodLogs or len(request.moodLogs) == 0:
            raise HTTPException(status_code=400, detail="Mood logs are required for prediction")
        
        result = predictive_analyzer.predict(
            mood_logs=request.moodLogs,
            voice_biometrics=request.voiceBiometrics,
            behavioral_data=request.behavioralData
        )
        return PredictionResponse(**result)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


# Real-time sentiment endpoint (for live journal analysis)
@app.post("/analyze/realtime")
async def analyze_realtime(request: TextAnalysisRequest):
    """
    Lightweight real-time sentiment analysis for live typing
    Returns quick sentiment score without full analysis
    """
    try:
        if not request.text or len(request.text.strip()) < 3:
            return {"sentimentScore": 0.5, "sentiment": "neutral"}
        
        result = sentiment_analyzer.quick_analyze(request.text)
        return result
    
    except Exception as e:
        return {"sentimentScore": 0.5, "sentiment": "neutral", "error": str(e)}


# Batch analysis endpoint
@app.post("/analyze/batch")
async def analyze_batch(texts: List[str]):
    """
    Analyze multiple texts in batch
    """
    try:
        results = []
        for text in texts:
            if text and len(text.strip()) > 0:
                result = sentiment_analyzer.analyze(text)
                results.append(result)
            else:
                results.append(None)
        return {"results": results}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch analysis failed: {str(e)}")


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=os.getenv("ENV", "development") == "development"
    )
