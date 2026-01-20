"""
Predictive Analysis Service
Mental health trend prediction and proactive wellness alerts
"""

import numpy as np
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta


class PredictiveAnalyzer:
    """
    Predicts mental health trends and generates proactive wellness alerts
    
    Features:
    - Burnout risk assessment
    - Anxiety trend prediction
    - Mood trend forecasting
    - Proactive wellness insights (20% decline trigger)
    
    Uses ensemble of:
    - Moving averages for trend detection
    - Statistical analysis for anomaly detection
    - Rule-based insights for actionable recommendations
    """
    
    def __init__(self):
        # Alert thresholds
        self.decline_threshold = 0.20  # 20% decline triggers alert
        self.burnout_threshold = 0.7   # High burnout risk threshold
        self.anxiety_threshold = 7     # High anxiety level (out of 10)
        
        # Weights for different data sources
        self.weights = {
            "mood": 0.35,
            "sleep": 0.20,
            "anxiety": 0.25,
            "voice": 0.10,
            "behavioral": 0.10,
        }
    
    def predict(
        self,
        mood_logs: List[Dict[str, Any]],
        voice_biometrics: Optional[List[Dict[str, Any]]] = None,
        behavioral_data: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Generate predictions and insights from user data
        
        Args:
            mood_logs: List of mood log entries
            voice_biometrics: Optional list of voice analysis results
            behavioral_data: Optional list of behavioral data (sleep, activity)
            
        Returns:
            Dictionary containing predictions and insights
        """
        # Extract time series data
        mood_series = self._extract_mood_series(mood_logs)
        mhi_series = self._extract_mhi_series(mood_logs)
        anxiety_series = self._extract_anxiety_series(mood_logs)
        sleep_series = self._extract_sleep_series(mood_logs)
        
        # Calculate burnout risk
        burnout_risk = self._calculate_burnout_risk(
            mood_series, anxiety_series, sleep_series, voice_biometrics
        )
        
        # Predict anxiety trend
        anxiety_prediction = self._predict_anxiety_trend(anxiety_series)
        
        # Predict mood trend
        mood_prediction = self._predict_mood_trend(mood_series, mhi_series)
        
        # Generate proactive insights
        proactive_insights = self._generate_proactive_insights(
            mhi_series, mood_series, anxiety_series, sleep_series, burnout_risk
        )
        
        # Calculate confidence based on data availability
        confidence = self._calculate_confidence(
            len(mood_logs), voice_biometrics, behavioral_data
        )
        
        return {
            "burnoutRiskScore": round(burnout_risk, 2),
            "anxietyTrendPrediction": anxiety_prediction,
            "moodTrendPrediction": mood_prediction,
            "proactiveInsights": proactive_insights,
            "confidence": round(confidence, 4),
        }
    
    def _extract_mood_series(self, mood_logs: List[Dict[str, Any]]) -> np.ndarray:
        """Extract mood scores as time series"""
        scores = []
        for log in mood_logs:
            score = log.get("moodScore") or log.get("mood_score")
            if score is not None:
                scores.append(float(score))
        return np.array(scores) if scores else np.array([5.0])
    
    def _extract_mhi_series(self, mood_logs: List[Dict[str, Any]]) -> np.ndarray:
        """Extract Mental Health Index as time series"""
        scores = []
        for log in mood_logs:
            score = log.get("mentalHealthIndex") or log.get("mental_health_index")
            if score is not None:
                scores.append(float(score))
        return np.array(scores) if scores else np.array([50.0])
    
    def _extract_anxiety_series(self, mood_logs: List[Dict[str, Any]]) -> np.ndarray:
        """Extract anxiety levels as time series"""
        scores = []
        for log in mood_logs:
            score = log.get("anxietyLevel") or log.get("anxiety_level")
            if score is not None:
                scores.append(float(score))
        return np.array(scores) if scores else np.array([5.0])
    
    def _extract_sleep_series(self, mood_logs: List[Dict[str, Any]]) -> np.ndarray:
        """Extract sleep quality as time series"""
        scores = []
        for log in mood_logs:
            score = log.get("sleepQuality") or log.get("sleep_quality")
            if score is not None:
                scores.append(float(score))
        return np.array(scores) if scores else np.array([5.0])
    
    def _calculate_burnout_risk(
        self,
        mood_series: np.ndarray,
        anxiety_series: np.ndarray,
        sleep_series: np.ndarray,
        voice_biometrics: Optional[List[Dict[str, Any]]]
    ) -> float:
        """
        Calculate burnout risk score (0-10)
        
        Factors:
        - Declining mood trend
        - Elevated anxiety
        - Poor sleep quality
        - Flat affect in voice (if available)
        """
        risk_score = 0.0
        
        # Mood factor (lower mood = higher risk)
        if len(mood_series) > 0:
            avg_mood = np.mean(mood_series)
            mood_risk = (10 - avg_mood) / 10  # Normalize to 0-1
            risk_score += mood_risk * 3  # Weight: 3
        
        # Anxiety factor (higher anxiety = higher risk)
        if len(anxiety_series) > 0:
            avg_anxiety = np.mean(anxiety_series)
            anxiety_risk = avg_anxiety / 10  # Normalize to 0-1
            risk_score += anxiety_risk * 3  # Weight: 3
        
        # Sleep factor (lower sleep quality = higher risk)
        if len(sleep_series) > 0:
            avg_sleep = np.mean(sleep_series)
            sleep_risk = (10 - avg_sleep) / 10  # Normalize to 0-1
            risk_score += sleep_risk * 2  # Weight: 2
        
        # Trend factor (declining trend = higher risk)
        if len(mood_series) >= 3:
            trend = self._calculate_trend(mood_series)
            if trend < 0:
                risk_score += abs(trend) * 2  # Weight: 2
        
        # Voice factor (flat affect = higher risk)
        if voice_biometrics and len(voice_biometrics) > 0:
            avg_flat_affect = np.mean([
                v.get("flatAffectScore", 0) or v.get("flat_affect_score", 0)
                for v in voice_biometrics
            ])
            risk_score += avg_flat_affect * 2  # Weight: 2
        
        # Normalize to 0-10 scale
        return min(10, max(0, risk_score))
    
    def _predict_anxiety_trend(self, anxiety_series: np.ndarray) -> Dict[str, Any]:
        """Predict anxiety trend for next 7 days"""
        if len(anxiety_series) < 2:
            return {
                "trend": "stable",
                "predictedValues": [float(anxiety_series[0])] * 7 if len(anxiety_series) > 0 else [5.0] * 7,
                "confidence": 0.3,
            }
        
        # Calculate trend
        trend = self._calculate_trend(anxiety_series)
        
        # Determine trend direction
        if trend > 0.5:
            trend_label = "increasing"
        elif trend < -0.5:
            trend_label = "decreasing"
        else:
            trend_label = "stable"
        
        # Simple linear prediction
        last_value = anxiety_series[-1]
        predicted_values = []
        for i in range(7):
            predicted = last_value + (trend * (i + 1))
            predicted = max(0, min(10, predicted))  # Clamp to 0-10
            predicted_values.append(round(float(predicted), 2))
        
        # Calculate confidence based on data consistency
        confidence = self._calculate_prediction_confidence(anxiety_series)
        
        return {
            "trend": trend_label,
            "predictedValues": predicted_values,
            "confidence": round(confidence, 4),
        }
    
    def _predict_mood_trend(
        self, 
        mood_series: np.ndarray, 
        mhi_series: np.ndarray
    ) -> Dict[str, Any]:
        """Predict mood and MHI trend for next 7 days"""
        if len(mood_series) < 2:
            return {
                "trend": "stable",
                "predictedMood": [float(mood_series[0])] * 7 if len(mood_series) > 0 else [5.0] * 7,
                "predictedMHI": [float(mhi_series[0])] * 7 if len(mhi_series) > 0 else [50.0] * 7,
                "confidence": 0.3,
            }
        
        # Calculate trends
        mood_trend = self._calculate_trend(mood_series)
        mhi_trend = self._calculate_trend(mhi_series)
        
        # Determine overall trend
        avg_trend = (mood_trend + mhi_trend / 10) / 2
        if avg_trend > 0.3:
            trend_label = "improving"
        elif avg_trend < -0.3:
            trend_label = "declining"
        else:
            trend_label = "stable"
        
        # Predict mood values
        last_mood = mood_series[-1]
        predicted_mood = []
        for i in range(7):
            predicted = last_mood + (mood_trend * (i + 1))
            predicted = max(1, min(10, predicted))
            predicted_mood.append(round(float(predicted), 2))
        
        # Predict MHI values
        last_mhi = mhi_series[-1]
        predicted_mhi = []
        for i in range(7):
            predicted = last_mhi + (mhi_trend * (i + 1))
            predicted = max(0, min(100, predicted))
            predicted_mhi.append(round(float(predicted), 2))
        
        confidence = self._calculate_prediction_confidence(mood_series)
        
        return {
            "trend": trend_label,
            "predictedMood": predicted_mood,
            "predictedMHI": predicted_mhi,
            "confidence": round(confidence, 4),
        }
    
    def _generate_proactive_insights(
        self,
        mhi_series: np.ndarray,
        mood_series: np.ndarray,
        anxiety_series: np.ndarray,
        sleep_series: np.ndarray,
        burnout_risk: float
    ) -> List[Dict[str, Any]]:
        """Generate proactive wellness insights"""
        insights = []
        
        # Check for 20% MHI decline
        if len(mhi_series) >= 3:
            recent_avg = np.mean(mhi_series[-3:])
            older_avg = np.mean(mhi_series[:-3]) if len(mhi_series) > 3 else mhi_series[0]
            
            if older_avg > 0:
                decline = (older_avg - recent_avg) / older_avg
                
                if decline >= self.decline_threshold:
                    insights.append({
                        "type": "mhi_decline",
                        "severity": "high",
                        "message": f"Your Mental Health Index has declined by {round(decline * 100)}% over the past few days. Consider reaching out to a mental health professional.",
                        "recommendation": "Schedule a check-in with your therapist or counselor.",
                        "triggerValue": round(decline * 100, 1),
                    })
        
        # High burnout risk alert
        if burnout_risk >= 7:
            insights.append({
                "type": "burnout_risk",
                "severity": "high",
                "message": "Your burnout risk is elevated. It's important to prioritize self-care.",
                "recommendation": "Take breaks, practice relaxation techniques, and ensure adequate sleep.",
                "triggerValue": round(burnout_risk, 1),
            })
        elif burnout_risk >= 5:
            insights.append({
                "type": "burnout_risk",
                "severity": "medium",
                "message": "You may be at moderate risk for burnout. Monitor your stress levels.",
                "recommendation": "Consider incorporating stress-reduction activities into your routine.",
                "triggerValue": round(burnout_risk, 1),
            })
        
        # Anxiety trend alert
        if len(anxiety_series) >= 3:
            recent_anxiety = np.mean(anxiety_series[-3:])
            if recent_anxiety >= self.anxiety_threshold:
                insights.append({
                    "type": "anxiety_elevated",
                    "severity": "high" if recent_anxiety >= 8 else "medium",
                    "message": f"Your anxiety levels have been elevated (avg: {round(recent_anxiety, 1)}/10).",
                    "recommendation": "Try breathing exercises, meditation, or speak with a professional.",
                    "triggerValue": round(recent_anxiety, 1),
                })
        
        # Sleep quality alert
        if len(sleep_series) >= 3:
            recent_sleep = np.mean(sleep_series[-3:])
            if recent_sleep < 5:
                insights.append({
                    "type": "sleep_quality",
                    "severity": "medium",
                    "message": f"Your sleep quality has been below average (avg: {round(recent_sleep, 1)}/10).",
                    "recommendation": "Establish a consistent sleep schedule and limit screen time before bed.",
                    "triggerValue": round(recent_sleep, 1),
                })
        
        # Positive trend recognition
        if len(mood_series) >= 5:
            trend = self._calculate_trend(mood_series)
            if trend > 0.5:
                insights.append({
                    "type": "positive_trend",
                    "severity": "low",
                    "message": "Great progress! Your mood has been improving consistently.",
                    "recommendation": "Keep up the positive habits that are working for you.",
                    "triggerValue": round(trend, 2),
                })
        
        return insights
    
    def _calculate_trend(self, series: np.ndarray) -> float:
        """Calculate linear trend of a time series"""
        if len(series) < 2:
            return 0.0
        
        x = np.arange(len(series))
        
        # Simple linear regression
        n = len(series)
        sum_x = np.sum(x)
        sum_y = np.sum(series)
        sum_xy = np.sum(x * series)
        sum_x2 = np.sum(x ** 2)
        
        denominator = n * sum_x2 - sum_x ** 2
        if denominator == 0:
            return 0.0
        
        slope = (n * sum_xy - sum_x * sum_y) / denominator
        
        return float(slope)
    
    def _calculate_prediction_confidence(self, series: np.ndarray) -> float:
        """Calculate confidence in predictions based on data consistency"""
        if len(series) < 3:
            return 0.3
        
        # Higher confidence with more data points
        data_factor = min(1.0, len(series) / 14)  # Max confidence at 14 days
        
        # Lower confidence with high variance
        if np.mean(series) > 0:
            cv = np.std(series) / np.mean(series)  # Coefficient of variation
            variance_factor = max(0.3, 1 - cv)
        else:
            variance_factor = 0.5
        
        confidence = (data_factor * 0.6 + variance_factor * 0.4)
        
        return min(0.95, max(0.3, confidence))
    
    def _calculate_confidence(
        self,
        mood_log_count: int,
        voice_biometrics: Optional[List[Dict[str, Any]]],
        behavioral_data: Optional[List[Dict[str, Any]]]
    ) -> float:
        """Calculate overall prediction confidence"""
        # Base confidence from mood logs
        base_confidence = min(0.7, mood_log_count / 14)
        
        # Bonus for voice data
        if voice_biometrics and len(voice_biometrics) > 0:
            base_confidence += 0.1
        
        # Bonus for behavioral data
        if behavioral_data and len(behavioral_data) > 0:
            base_confidence += 0.1
        
        return min(0.95, base_confidence)
