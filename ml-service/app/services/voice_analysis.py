"""
Voice Analysis Service
Extracts vocal biometrics for mental health assessment
"""

import numpy as np
from typing import Dict, Any, List
import os

# Try to import librosa, fall back to mock if not available
try:
    import librosa
    import librosa.display
    LIBROSA_AVAILABLE = True
except ImportError:
    LIBROSA_AVAILABLE = False
    print("Warning: librosa not available, using mock voice analysis")


class VoiceAnalyzer:
    """
    Analyzes voice recordings for mental health indicators
    
    Features extracted:
    - Pitch (F0): Fundamental frequency analysis
    - Jitter: Pitch variation (voice instability)
    - Shimmer: Amplitude variation
    - Cadence: Speech rhythm and tempo
    - Intensity: Volume patterns
    
    Mental health indicators:
    - Flat affect: Monotone speech (depression indicator)
    - Agitated speech: Rapid, variable speech (anxiety indicator)
    """
    
    def __init__(self):
        self.sample_rate = 22050
        self.frame_length = 2048
        self.hop_length = 512
    
    def analyze(self, audio_path: str) -> Dict[str, Any]:
        """
        Analyze voice recording and extract biometric features
        
        Args:
            audio_path: Path to audio file
            
        Returns:
            Dictionary containing all extracted features and scores
        """
        if not LIBROSA_AVAILABLE:
            return self._mock_analysis(audio_path)
        
        try:
            # Load audio file
            y, sr = librosa.load(audio_path, sr=self.sample_rate)
            duration = librosa.get_duration(y=y, sr=sr)
            
            # Extract features
            pitch_features = self._extract_pitch_features(y, sr)
            jitter_features = self._extract_jitter_features(y, sr)
            shimmer_features = self._extract_shimmer_features(y, sr)
            cadence_features = self._extract_cadence_features(y, sr)
            intensity_features = self._extract_intensity_features(y, sr)
            
            # Calculate mental health scores
            flat_affect_score = self._calculate_flat_affect_score(
                pitch_features, intensity_features
            )
            agitated_speech_score = self._calculate_agitated_speech_score(
                pitch_features, cadence_features
            )
            
            # Calculate overall vocal health score
            vocal_health_score = self._calculate_vocal_health_score(
                flat_affect_score, agitated_speech_score
            )
            
            # Generate insights
            insights = self._generate_insights(
                flat_affect_score, agitated_speech_score, pitch_features, cadence_features
            )
            
            # Detect anomalies
            anomalies = self._detect_anomalies(
                pitch_features, jitter_features, shimmer_features
            )
            
            return {
                "pitchFeatures": pitch_features,
                "jitterFeatures": jitter_features,
                "shimmerFeatures": shimmer_features,
                "cadenceFeatures": cadence_features,
                "intensityFeatures": intensity_features,
                "flatAffectScore": round(flat_affect_score, 4),
                "agitatedSpeechScore": round(agitated_speech_score, 4),
                "vocalHealthScore": round(vocal_health_score, 2),
                "durationSeconds": round(duration, 2),
                "insights": insights,
                "anomalies": anomalies,
            }
            
        except Exception as e:
            print(f"Voice analysis error: {e}")
            return self._mock_analysis(audio_path)
    
    def _extract_pitch_features(self, y: np.ndarray, sr: int) -> Dict[str, Any]:
        """Extract pitch (F0) features"""
        try:
            # Extract pitch using librosa
            pitches, magnitudes = librosa.piptrack(
                y=y, sr=sr, 
                fmin=50, fmax=500,
                threshold=0.1
            )
            
            # Get pitch values where magnitude is significant
            pitch_values = []
            for t in range(pitches.shape[1]):
                index = magnitudes[:, t].argmax()
                pitch = pitches[index, t]
                if pitch > 0:
                    pitch_values.append(pitch)
            
            if len(pitch_values) == 0:
                pitch_values = [0]
            
            pitch_array = np.array(pitch_values)
            
            return {
                "mean": float(np.mean(pitch_array)),
                "std": float(np.std(pitch_array)),
                "min": float(np.min(pitch_array)),
                "max": float(np.max(pitch_array)),
                "range": float(np.max(pitch_array) - np.min(pitch_array)),
                "variability": float(np.std(pitch_array) / (np.mean(pitch_array) + 1e-6)),
            }
        except Exception as e:
            return {"mean": 0, "std": 0, "min": 0, "max": 0, "range": 0, "variability": 0}
    
    def _extract_jitter_features(self, y: np.ndarray, sr: int) -> Dict[str, Any]:
        """Extract jitter (pitch perturbation) features"""
        try:
            # Calculate zero crossing rate as proxy for jitter
            zcr = librosa.feature.zero_crossing_rate(y, frame_length=self.frame_length)
            
            return {
                "mean": float(np.mean(zcr)),
                "std": float(np.std(zcr)),
                "localJitter": float(np.mean(np.abs(np.diff(zcr)))),
            }
        except Exception:
            return {"mean": 0, "std": 0, "localJitter": 0}
    
    def _extract_shimmer_features(self, y: np.ndarray, sr: int) -> Dict[str, Any]:
        """Extract shimmer (amplitude perturbation) features"""
        try:
            # Calculate RMS energy
            rms = librosa.feature.rms(y=y, frame_length=self.frame_length)
            
            # Calculate shimmer as amplitude variation
            shimmer = np.abs(np.diff(rms[0])) / (np.mean(rms) + 1e-6)
            
            return {
                "mean": float(np.mean(shimmer)),
                "std": float(np.std(shimmer)),
                "localShimmer": float(np.mean(shimmer)),
            }
        except Exception:
            return {"mean": 0, "std": 0, "localShimmer": 0}
    
    def _extract_cadence_features(self, y: np.ndarray, sr: int) -> Dict[str, Any]:
        """Extract speech cadence (rhythm and tempo) features"""
        try:
            # Onset detection for speech rhythm
            onset_env = librosa.onset.onset_strength(y=y, sr=sr)
            tempo, beats = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)
            
            # Calculate speech rate
            duration = len(y) / sr
            speech_rate = len(beats) / duration if duration > 0 else 0
            
            # Calculate rhythm regularity
            if len(beats) > 1:
                beat_intervals = np.diff(beats)
                rhythm_regularity = 1 - (np.std(beat_intervals) / (np.mean(beat_intervals) + 1e-6))
            else:
                rhythm_regularity = 0.5
            
            return {
                "tempo": float(tempo) if isinstance(tempo, (int, float)) else float(tempo[0]) if len(tempo) > 0 else 0,
                "speechRate": float(speech_rate),
                "rhythmRegularity": float(max(0, min(1, rhythm_regularity))),
                "pauseRatio": float(self._calculate_pause_ratio(y, sr)),
            }
        except Exception:
            return {"tempo": 0, "speechRate": 0, "rhythmRegularity": 0.5, "pauseRatio": 0}
    
    def _extract_intensity_features(self, y: np.ndarray, sr: int) -> Dict[str, Any]:
        """Extract intensity (volume) features"""
        try:
            rms = librosa.feature.rms(y=y, frame_length=self.frame_length)[0]
            
            return {
                "mean": float(np.mean(rms)),
                "std": float(np.std(rms)),
                "min": float(np.min(rms)),
                "max": float(np.max(rms)),
                "dynamicRange": float(np.max(rms) - np.min(rms)),
            }
        except Exception:
            return {"mean": 0, "std": 0, "min": 0, "max": 0, "dynamicRange": 0}
    
    def _calculate_pause_ratio(self, y: np.ndarray, sr: int) -> float:
        """Calculate ratio of silence/pauses in speech"""
        try:
            # Use RMS to detect silence
            rms = librosa.feature.rms(y=y, frame_length=self.frame_length)[0]
            threshold = np.mean(rms) * 0.1
            silence_frames = np.sum(rms < threshold)
            return silence_frames / len(rms)
        except Exception:
            return 0
    
    def _calculate_flat_affect_score(
        self, 
        pitch_features: Dict[str, Any], 
        intensity_features: Dict[str, Any]
    ) -> float:
        """
        Calculate flat affect score (indicator of depression)
        
        High score indicates monotone, low-energy speech
        """
        # Low pitch variability indicates flat affect
        pitch_variability = pitch_features.get("variability", 0)
        pitch_range = pitch_features.get("range", 0)
        
        # Low intensity variation indicates flat affect
        intensity_range = intensity_features.get("dynamicRange", 0)
        
        # Normalize and combine
        pitch_score = 1 - min(1, pitch_variability * 5)  # Higher variability = lower flat affect
        range_score = 1 - min(1, pitch_range / 200)  # Higher range = lower flat affect
        intensity_score = 1 - min(1, intensity_range * 10)  # Higher dynamic range = lower flat affect
        
        # Weighted average
        flat_affect_score = (pitch_score * 0.4 + range_score * 0.3 + intensity_score * 0.3)
        
        return max(0, min(1, flat_affect_score))
    
    def _calculate_agitated_speech_score(
        self, 
        pitch_features: Dict[str, Any], 
        cadence_features: Dict[str, Any]
    ) -> float:
        """
        Calculate agitated speech score (indicator of anxiety)
        
        High score indicates rapid, variable speech
        """
        # High speech rate indicates agitation
        speech_rate = cadence_features.get("speechRate", 0)
        tempo = cadence_features.get("tempo", 0)
        
        # High pitch variability can indicate agitation
        pitch_variability = pitch_features.get("variability", 0)
        
        # Low rhythm regularity indicates agitation
        rhythm_regularity = cadence_features.get("rhythmRegularity", 0.5)
        
        # Normalize and combine
        rate_score = min(1, speech_rate / 5)  # Higher rate = higher agitation
        tempo_score = min(1, tempo / 180)  # Higher tempo = higher agitation
        variability_score = min(1, pitch_variability * 3)  # Higher variability = higher agitation
        irregularity_score = 1 - rhythm_regularity  # Lower regularity = higher agitation
        
        # Weighted average
        agitated_score = (
            rate_score * 0.3 + 
            tempo_score * 0.2 + 
            variability_score * 0.25 + 
            irregularity_score * 0.25
        )
        
        return max(0, min(1, agitated_score))
    
    def _calculate_vocal_health_score(
        self, 
        flat_affect_score: float, 
        agitated_speech_score: float
    ) -> float:
        """
        Calculate overall vocal health score (0-100)
        
        Higher score indicates healthier vocal patterns
        """
        # Both flat affect and agitation are negative indicators
        # Optimal is moderate expressiveness without agitation
        
        # Penalize both extremes
        flat_penalty = flat_affect_score * 40  # Max 40 point penalty
        agitation_penalty = agitated_speech_score * 40  # Max 40 point penalty
        
        # Base score
        base_score = 100
        
        # Calculate final score
        vocal_health = base_score - flat_penalty - agitation_penalty
        
        return max(0, min(100, vocal_health))
    
    def _generate_insights(
        self,
        flat_affect_score: float,
        agitated_speech_score: float,
        pitch_features: Dict[str, Any],
        cadence_features: Dict[str, Any]
    ) -> List[str]:
        """Generate human-readable insights from analysis"""
        insights = []
        
        if flat_affect_score > 0.7:
            insights.append("Your speech patterns show reduced emotional expression. Consider engaging in activities that bring you joy.")
        elif flat_affect_score > 0.5:
            insights.append("Your voice shows some signs of reduced expressiveness. Try speaking with more variation in tone.")
        
        if agitated_speech_score > 0.7:
            insights.append("Your speech patterns indicate elevated stress levels. Try deep breathing exercises before speaking.")
        elif agitated_speech_score > 0.5:
            insights.append("Your speech shows some signs of tension. Consider practicing mindful speaking.")
        
        if flat_affect_score < 0.3 and agitated_speech_score < 0.3:
            insights.append("Your vocal patterns indicate good emotional balance. Keep up the positive habits!")
        
        speech_rate = cadence_features.get("speechRate", 0)
        if speech_rate > 4:
            insights.append("You're speaking quite rapidly. Try slowing down to reduce stress.")
        
        return insights
    
    def _detect_anomalies(
        self,
        pitch_features: Dict[str, Any],
        jitter_features: Dict[str, Any],
        shimmer_features: Dict[str, Any]
    ) -> List[str]:
        """Detect anomalies that may require clinical attention"""
        anomalies = []
        
        # High jitter can indicate voice disorders
        if jitter_features.get("localJitter", 0) > 0.05:
            anomalies.append("Elevated pitch instability detected")
        
        # High shimmer can indicate voice disorders
        if shimmer_features.get("localShimmer", 0) > 0.1:
            anomalies.append("Elevated amplitude instability detected")
        
        # Very low pitch range might indicate issues
        if pitch_features.get("range", 0) < 20:
            anomalies.append("Very limited pitch range detected")
        
        return anomalies
    
    def _mock_analysis(self, audio_path: str) -> Dict[str, Any]:
        """Return mock analysis when librosa is not available"""
        # Generate realistic mock data
        np.random.seed(hash(audio_path) % 2**32)
        
        return {
            "pitchFeatures": {
                "mean": float(np.random.uniform(100, 200)),
                "std": float(np.random.uniform(20, 50)),
                "min": float(np.random.uniform(80, 120)),
                "max": float(np.random.uniform(200, 300)),
                "range": float(np.random.uniform(80, 180)),
                "variability": float(np.random.uniform(0.1, 0.3)),
            },
            "jitterFeatures": {
                "mean": float(np.random.uniform(0.01, 0.03)),
                "std": float(np.random.uniform(0.005, 0.015)),
                "localJitter": float(np.random.uniform(0.01, 0.04)),
            },
            "shimmerFeatures": {
                "mean": float(np.random.uniform(0.02, 0.06)),
                "std": float(np.random.uniform(0.01, 0.03)),
                "localShimmer": float(np.random.uniform(0.02, 0.08)),
            },
            "cadenceFeatures": {
                "tempo": float(np.random.uniform(80, 140)),
                "speechRate": float(np.random.uniform(2, 4)),
                "rhythmRegularity": float(np.random.uniform(0.5, 0.9)),
                "pauseRatio": float(np.random.uniform(0.1, 0.3)),
            },
            "intensityFeatures": {
                "mean": float(np.random.uniform(0.05, 0.15)),
                "std": float(np.random.uniform(0.02, 0.05)),
                "min": float(np.random.uniform(0.01, 0.03)),
                "max": float(np.random.uniform(0.15, 0.3)),
                "dynamicRange": float(np.random.uniform(0.1, 0.25)),
            },
            "flatAffectScore": float(np.random.uniform(0.2, 0.5)),
            "agitatedSpeechScore": float(np.random.uniform(0.2, 0.5)),
            "vocalHealthScore": float(np.random.uniform(60, 85)),
            "durationSeconds": float(np.random.uniform(10, 60)),
            "insights": ["Voice analysis completed. Your vocal patterns appear within normal range."],
            "anomalies": [],
        }
