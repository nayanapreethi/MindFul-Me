"""
Sentiment Analysis Service
Text-based sentiment and emotion detection for mental health assessment
"""

import re
from typing import Dict, Any, List
import numpy as np

# Try to import transformers, fall back to rule-based if not available
try:
    from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification
    import torch
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False
    print("Warning: transformers not available, using rule-based sentiment analysis")


class SentimentAnalyzer:
    """
    Analyzes text for sentiment and emotional content
    
    Uses RoBERTa-based models when available, falls back to rule-based analysis
    
    Features:
    - Sentiment score (-1 to 1)
    - Emotion detection (joy, sadness, anger, fear, surprise, disgust)
    - Key phrase extraction
    - Mental health insights
    """
    
    def __init__(self):
        self.sentiment_model = None
        self.emotion_model = None
        
        if TRANSFORMERS_AVAILABLE:
            try:
                # Load sentiment analysis model
                self.sentiment_model = pipeline(
                    "sentiment-analysis",
                    model="cardiffnlp/twitter-roberta-base-sentiment-latest",
                    device=-1  # CPU
                )
                
                # Load emotion detection model
                self.emotion_model = pipeline(
                    "text-classification",
                    model="j-hartmann/emotion-english-distilroberta-base",
                    top_k=None,
                    device=-1
                )
            except Exception as e:
                print(f"Error loading models: {e}")
                self.sentiment_model = None
                self.emotion_model = None
        
        # Emotion keywords for rule-based fallback
        self.emotion_keywords = {
            "joy": ["happy", "joy", "excited", "wonderful", "great", "amazing", "love", "grateful", "blessed", "fantastic"],
            "sadness": ["sad", "depressed", "unhappy", "miserable", "hopeless", "lonely", "grief", "sorrow", "crying", "tears"],
            "anger": ["angry", "furious", "annoyed", "frustrated", "irritated", "mad", "rage", "hate", "resentful"],
            "fear": ["afraid", "scared", "anxious", "worried", "nervous", "terrified", "panic", "dread", "uneasy"],
            "surprise": ["surprised", "shocked", "amazed", "astonished", "unexpected", "startled"],
            "disgust": ["disgusted", "revolted", "sick", "repulsed", "awful", "terrible", "gross"],
        }
        
        # Positive and negative word lists
        self.positive_words = set([
            "good", "great", "excellent", "amazing", "wonderful", "fantastic", "happy",
            "joy", "love", "peaceful", "calm", "relaxed", "grateful", "blessed",
            "hopeful", "optimistic", "confident", "strong", "healthy", "better",
            "improved", "progress", "success", "achievement", "proud", "satisfied"
        ])
        
        self.negative_words = set([
            "bad", "terrible", "awful", "horrible", "sad", "depressed", "anxious",
            "worried", "stressed", "overwhelmed", "exhausted", "tired", "hopeless",
            "helpless", "worthless", "guilty", "ashamed", "angry", "frustrated",
            "lonely", "isolated", "scared", "afraid", "panic", "crisis", "suicidal"
        ])
        
        # Crisis keywords for immediate attention
        self.crisis_keywords = [
            "suicide", "suicidal", "kill myself", "end my life", "want to die",
            "self-harm", "cutting", "hurt myself", "no reason to live"
        ]
    
    def analyze(self, text: str) -> Dict[str, Any]:
        """
        Perform full sentiment and emotion analysis
        
        Args:
            text: Input text to analyze
            
        Returns:
            Dictionary containing sentiment score, emotions, key phrases, and insights
        """
        # Clean text
        cleaned_text = self._clean_text(text)
        
        # Check for crisis keywords
        is_crisis = self._check_crisis(cleaned_text)
        
        # Get sentiment
        if self.sentiment_model:
            sentiment_result = self._model_sentiment(cleaned_text)
        else:
            sentiment_result = self._rule_based_sentiment(cleaned_text)
        
        # Get emotions
        if self.emotion_model:
            emotions = self._model_emotions(cleaned_text)
        else:
            emotions = self._rule_based_emotions(cleaned_text)
        
        # Extract key phrases
        key_phrases = self._extract_key_phrases(cleaned_text)
        
        # Generate insights
        insights = self._generate_insights(sentiment_result, emotions, is_crisis)
        
        return {
            "sentimentScore": sentiment_result["score"],
            "sentiment": sentiment_result["label"],
            "emotions": emotions,
            "keyPhrases": key_phrases,
            "insights": insights,
            "isCrisis": is_crisis,
        }
    
    def quick_analyze(self, text: str) -> Dict[str, Any]:
        """
        Quick sentiment analysis for real-time feedback
        
        Args:
            text: Input text to analyze
            
        Returns:
            Dictionary with sentiment score and label only
        """
        cleaned_text = self._clean_text(text)
        
        if self.sentiment_model:
            result = self._model_sentiment(cleaned_text)
        else:
            result = self._rule_based_sentiment(cleaned_text)
        
        return {
            "sentimentScore": result["score"],
            "sentiment": result["label"],
        }
    
    def _clean_text(self, text: str) -> str:
        """Clean and normalize text"""
        # Convert to lowercase
        text = text.lower()
        
        # Remove URLs
        text = re.sub(r'http\S+|www\S+', '', text)
        
        # Remove extra whitespace
        text = ' '.join(text.split())
        
        return text
    
    def _check_crisis(self, text: str) -> bool:
        """Check for crisis keywords"""
        text_lower = text.lower()
        for keyword in self.crisis_keywords:
            if keyword in text_lower:
                return True
        return False
    
    def _model_sentiment(self, text: str) -> Dict[str, Any]:
        """Get sentiment using transformer model"""
        try:
            result = self.sentiment_model(text[:512])[0]  # Limit to 512 tokens
            
            # Map model output to standardized format
            label = result["label"].lower()
            score = result["score"]
            
            if "positive" in label:
                return {"score": score, "label": "positive"}
            elif "negative" in label:
                return {"score": -score, "label": "negative"}
            else:
                return {"score": 0, "label": "neutral"}
                
        except Exception as e:
            print(f"Model sentiment error: {e}")
            return self._rule_based_sentiment(text)
    
    def _rule_based_sentiment(self, text: str) -> Dict[str, Any]:
        """Rule-based sentiment analysis fallback"""
        words = text.lower().split()
        
        positive_count = sum(1 for word in words if word in self.positive_words)
        negative_count = sum(1 for word in words if word in self.negative_words)
        
        total = positive_count + negative_count
        if total == 0:
            return {"score": 0, "label": "neutral"}
        
        score = (positive_count - negative_count) / total
        
        if score > 0.2:
            label = "positive"
        elif score < -0.2:
            label = "negative"
        else:
            label = "neutral"
        
        return {"score": round(score, 4), "label": label}
    
    def _model_emotions(self, text: str) -> Dict[str, float]:
        """Get emotions using transformer model"""
        try:
            results = self.emotion_model(text[:512])[0]
            
            emotions = {}
            for result in results:
                emotions[result["label"].lower()] = round(result["score"], 4)
            
            return emotions
            
        except Exception as e:
            print(f"Model emotion error: {e}")
            return self._rule_based_emotions(text)
    
    def _rule_based_emotions(self, text: str) -> Dict[str, float]:
        """Rule-based emotion detection fallback"""
        words = set(text.lower().split())
        
        emotions = {}
        total_matches = 0
        
        for emotion, keywords in self.emotion_keywords.items():
            matches = sum(1 for keyword in keywords if keyword in words)
            emotions[emotion] = matches
            total_matches += matches
        
        # Normalize scores
        if total_matches > 0:
            for emotion in emotions:
                emotions[emotion] = round(emotions[emotion] / total_matches, 4)
        else:
            # Default neutral distribution
            for emotion in emotions:
                emotions[emotion] = round(1 / len(emotions), 4)
        
        return emotions
    
    def _extract_key_phrases(self, text: str) -> List[str]:
        """Extract key phrases from text"""
        # Simple extraction based on important words
        words = text.split()
        
        # Filter out common words
        stop_words = {
            "i", "me", "my", "myself", "we", "our", "ours", "you", "your",
            "he", "she", "it", "they", "them", "what", "which", "who",
            "this", "that", "these", "those", "am", "is", "are", "was",
            "were", "be", "been", "being", "have", "has", "had", "do",
            "does", "did", "will", "would", "could", "should", "may",
            "might", "must", "shall", "can", "need", "dare", "ought",
            "used", "a", "an", "the", "and", "but", "if", "or", "because",
            "as", "until", "while", "of", "at", "by", "for", "with",
            "about", "against", "between", "into", "through", "during",
            "before", "after", "above", "below", "to", "from", "up",
            "down", "in", "out", "on", "off", "over", "under", "again",
            "further", "then", "once", "here", "there", "when", "where",
            "why", "how", "all", "each", "few", "more", "most", "other",
            "some", "such", "no", "nor", "not", "only", "own", "same",
            "so", "than", "too", "very", "just", "also", "now", "today",
            "feeling", "feel", "felt", "think", "thought", "really", "like"
        }
        
        # Extract meaningful words
        meaningful_words = [
            word for word in words 
            if word not in stop_words and len(word) > 2
        ]
        
        # Get unique phrases (simple bigrams)
        phrases = []
        for i in range(len(meaningful_words) - 1):
            phrase = f"{meaningful_words[i]} {meaningful_words[i+1]}"
            if phrase not in phrases:
                phrases.append(phrase)
        
        # Also add single important words
        for word in meaningful_words[:5]:
            if word not in phrases:
                phrases.append(word)
        
        return phrases[:10]  # Return top 10 phrases
    
    def _generate_insights(
        self, 
        sentiment: Dict[str, Any], 
        emotions: Dict[str, float],
        is_crisis: bool
    ) -> List[str]:
        """Generate mental health insights from analysis"""
        insights = []
        
        # Crisis alert
        if is_crisis:
            insights.append("⚠️ Your entry contains concerning language. Please reach out to a mental health professional or crisis helpline if you're struggling.")
        
        # Sentiment-based insights
        if sentiment["label"] == "positive":
            insights.append("Your writing reflects a positive mindset. Keep nurturing these positive thoughts!")
        elif sentiment["label"] == "negative":
            insights.append("Your entry suggests you may be going through a difficult time. Remember, it's okay to seek support.")
        
        # Emotion-based insights
        dominant_emotion = max(emotions.items(), key=lambda x: x[1]) if emotions else None
        
        if dominant_emotion:
            emotion_name, emotion_score = dominant_emotion
            
            if emotion_score > 0.5:
                emotion_insights = {
                    "joy": "Your joy is evident in your writing. Celebrate these positive moments!",
                    "sadness": "It's okay to feel sad. Consider talking to someone you trust about how you're feeling.",
                    "anger": "Anger is a natural emotion. Try some calming techniques like deep breathing.",
                    "fear": "Anxiety can be overwhelming. Grounding exercises might help you feel more centered.",
                    "surprise": "Life can be full of unexpected moments. Take time to process your experiences.",
                    "disgust": "Strong reactions are valid. Consider what's triggering these feelings.",
                }
                
                if emotion_name in emotion_insights:
                    insights.append(emotion_insights[emotion_name])
        
        # Add general wellness tip if no specific insights
        if len(insights) == 0:
            insights.append("Thank you for journaling. Regular reflection is great for mental wellness.")
        
        return insights
