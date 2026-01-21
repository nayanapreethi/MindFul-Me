/**
 * Psychometric Intake Screen
 * PHQ-9 and GAD-7 assessment forms
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

// PHQ-9 Questions
const PHQ9_QUESTIONS = [
  {
    id: 'phq1',
    question: 'Little interest or pleasure in doing things?',
    text: 'Over the last 2 weeks, how often have you felt:',
  },
  {
    id: 'phq2',
    question: 'Feeling down, depressed, or hopeless?',
  },
  {
    id: 'phq3',
    question: 'Trouble falling or staying asleep, or sleeping too much?',
  },
  {
    id: 'phq4',
    question: 'Feeling tired or having little energy?',
  },
  {
    id: 'phq5',
    question: 'Poor appetite or overeating?',
  },
  {
    id: 'phq6',
    question: 'Feeling bad about yourself — or that you\'re a failure?',
  },
  {
    id: 'phq7',
    question: 'Trouble concentrating on things, such as reading?',
  },
  {
    id: 'phq8',
    question: 'Moving or speaking so slowly that others have noticed?',
  },
  {
    id: 'phq9',
    question: 'Thoughts that you would be better off dead or hurting yourself?',
  },
];

// GAD-7 Questions
const GAD7_QUESTIONS = [
  {
    id: 'gad1',
    text: 'Over the last 2 weeks, how often have you felt:',
    question: 'Feeling nervous, anxious, or on edge?',
  },
  {
    id: 'gad2',
    question: 'Not being able to stop or control worrying?',
  },
  {
    id: 'gad3',
    question: 'Worrying too much about different things?',
  },
  {
    id: 'gad4',
    question: 'Trouble relaxing?',
  },
  {
    id: 'gad5',
    question: 'Being so restless that it\'s hard to sit still?',
  },
  {
    id: 'gad6',
    question: 'Becoming easily annoyed or irritable?',
  },
  {
    id: 'gad7',
    question: 'Feeling afraid, as if something awful might happen?',
  },
];

const FREQUENCY_OPTIONS = [
  { value: 0, label: 'Not at all' },
  { value: 1, label: 'Several days' },
  { value: 2, label: 'More than half the days' },
  { value: 3, label: 'Nearly every day' },
];

interface IntakeFormScreenProps {
  onComplete: (phq9Score: number, gad7Score: number) => void;
}

const IntakeFormScreen: React.FC<IntakeFormScreenProps> = ({ onComplete }) => {
  const [currentSection, setCurrentSection] = useState<'info' | 'phq9' | 'gad7'>('info');
  const [phq9Answers, setPhq9Answers] = useState<{ [key: string]: number }>({});
  const [gad7Answers, setGad7Answers] = useState<{ [key: string]: number }>({});

  const handlePhq9Answer = (questionId: string, value: number) => {
    setPhq9Answers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleGad7Answer = (questionId: string, value: number) => {
    setGad7Answers(prev => ({ ...prev, [questionId]: value }));
  };

  const calculatePhq9Score = () => {
    return Object.values(phq9Answers).reduce((sum, val) => sum + val, 0);
  };

  const calculateGad7Score = () => {
    return Object.values(gad7Answers).reduce((sum, val) => sum + val, 0);
  };

  const getSeverityLabel = (score: number, type: 'phq9' | 'gad7') => {
    const ranges = type === 'phq9' 
      ? [
          { max: 4, label: 'Minimal depression', color: '#4CAF50' },
          { max: 9, label: 'Mild depression', color: '#8BC34A' },
          { max: 14, label: 'Moderate depression', color: '#FFC107' },
          { max: 19, label: 'Moderately severe depression', color: '#FF9800' },
          { max: 27, label: 'Severe depression', color: '#F44336' },
        ]
      : [
          { max: 4, label: 'Minimal anxiety', color: '#4CAF50' },
          { max: 9, label: 'Mild anxiety', color: '#8BC34A' },
          { max: 14, label: 'Moderate anxiety', color: '#FFC107' },
          { max: 21, label: 'Severe anxiety', color: '#F44336' },
        ];
    
    return ranges.find(r => score <= r.max) || ranges[ranges.length - 1];
  };

  const renderInfoScreen = () => (
    <View style={styles.infoContainer}>
      <Text style={styles.infoTitle}>Let's Establish Your Baseline</Text>
      <Text style={styles.infoSubtitle}>
        These brief assessments help us understand your current mental health status 
        and provide personalized insights.
      </Text>

      <View style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>📋 PHQ-9</Text>
        <Text style={styles.infoCardText}>
          A 9-question screening tool for depression. It takes about 2 minutes to complete.
        </Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>📋 GAD-7</Text>
        <Text style={styles.infoCardText}>
          A 7-question screening tool for anxiety. It takes about 2 minutes to complete.
        </Text>
      </View>

      <View style={styles.privacyNote}>
        <Text style={styles.privacyIcon}>🔒</Text>
        <Text style={styles.privacyText}>
          Your responses are private and stored securely. This data helps provide 
          better insights but is never shared without your permission.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.startButton}
        onPress={() => setCurrentSection('phq9')}
      >
        <Text style={styles.startButtonText}>Begin Assessment</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPhq9Screen = () => {
    const currentQuestion = Math.max(
      0,
      ...Object.keys(phq9Answers).map(k => parseInt(k.replace('phq', '')) || 0)
    );
    const nextQuestion = currentQuestion < 9 ? currentQuestion + 1 : null;
    const answeredCount = Object.keys(phq9Answers).length;

    if (currentQuestion === 0 && answeredCount === 0) {
      return (
        <View style={styles.questionContainer}>
          <Text style={styles.sectionTitle}>PHQ-9</Text>
          <Text style={styles.sectionSubtitle}>{PHQ9_QUESTIONS[0].text}</Text>
          <Text style={styles.questionText}>{PHQ9_QUESTIONS[0].question}</Text>
          {renderFrequencyOptions('phq1', handlePhq9Answer)}
        </View>
      );
    }

    const questionIndex = answeredCount;
    if (questionIndex >= PHQ9_QUESTIONS.length) {
      return renderPhq9Complete();
    }

    return (
      <View style={styles.questionContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[styles.progressFill, { width: `${(answeredCount / 9) * 100}%`}]} 
          />
        </View>
        <Text style={styles.progressText}>Question {answeredCount + 1} of 9</Text>

        <Text style={styles.questionText}>
          {PHQ9_QUESTIONS[questionIndex].question}
        </Text>
        {renderFrequencyOptions(
          PHQ9_QUESTIONS[questionIndex].id, 
          handlePhq9Answer
        )}
      </View>
    );
  };

  const renderPhq9Complete = () => {
    const score = calculatePhq9Score();
    const severity = getSeverityLabel(score, 'phq9');

    return (
      <View style={styles.resultContainer}>
        <Text style={styles.resultTitle}>PHQ-9 Complete</Text>
        <View style={[styles.scoreCircle, { backgroundColor: severity.color }]}>
          <Text style={styles.scoreText}>{score}</Text>
          <Text style={styles.scoreLabel}>Total Score</Text>
        </View>
        <Text style={[styles.severityLabel, { color: severity.color }]}>
          {severity.label}
        </Text>

        <TouchableOpacity
          style={styles.nextSectionButton}
          onPress={() => setCurrentSection('gad7')}
        >
          <Text style={styles.nextSectionButtonText}>Continue to Anxiety Assessment →</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderGad7Screen = () => {
    const answeredCount = Object.keys(gad7Answers).length;

    if (answeredCount === 0) {
      return (
        <View style={styles.questionContainer}>
          <Text style={styles.sectionTitle}>GAD-7</Text>
          <Text style={styles.sectionSubtitle}>{GAD7_QUESTIONS[0].text}</Text>
          <Text style={styles.questionText}>{GAD7_QUESTIONS[0].question}</Text>
          {renderFrequencyOptions('gad1', handleGad7Answer)}
        </View>
      );
    }

    const questionIndex = answeredCount;
    if (questionIndex >= GAD7_QUESTIONS.length) {
      const phq9Score = calculatePhq9Score();
      const gad7Score = calculateGad7Score();
      onComplete(phq9Score, gad7Score);
      return null;
    }

    return (
      <View style={styles.questionContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[styles.progressFill, { width: `${(answeredCount / 7) * 100}%`}]} 
          />
        </View>
        <Text style={styles.progressText}>Question {answeredCount + 1} of 7</Text>

        <Text style={styles.questionText}>
          {GAD7_QUESTIONS[questionIndex].question}
        </Text>
        {renderFrequencyOptions(
          GAD7_QUESTIONS[questionIndex].id, 
          handleGad7Answer
        )}
      </View>
    );
  };

  const renderFrequencyOptions = (
    questionId: string, 
    onAnswer: (id: string, val: number) => void
  ) => (
    <View style={styles.optionsContainer}>
      {FREQUENCY_OPTIONS.map(option => (
        <TouchableOpacity
          key={option.value}
          style={[
            styles.optionButton,
            questionId.startsWith('phq') && phq9Answers[questionId] === option.value && styles.selectedOption,
            questionId.startsWith('gad') && gad7Answers[questionId] === option.value && styles.selectedOption,
          ]}
          onPress={() => onAnswer(questionId, option.value)}
        >
          <Text 
            style={[
              styles.optionText,
              (questionId.startsWith('phq') && phq9Answers[questionId] === option.value) ||
              (questionId.startsWith('gad') && gad7Answers[questionId] === option.value) && styles.selectedOptionText,
            ]}
          >
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <LinearGradient colors={['#26A69A', '#00897B']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {currentSection !== 'info' && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (currentSection === 'gad7') setCurrentSection('phq9');
              else setCurrentSection('info');
            }}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {currentSection === 'info' && renderInfoScreen()}
          {currentSection === 'phq9' && renderPhq9Screen()}
          {currentSection === 'gad7' && renderGad7Screen()}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  infoTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 15,
  },
  infoSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  infoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  infoCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  infoCardText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 20,
  },
  privacyNote: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 30,
  },
  privacyIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  privacyText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 18,
  },
  startButton: {
    backgroundColor: '#fff',
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#00897B',
    fontSize: 18,
    fontWeight: '600',
  },
  questionContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 5,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 10,
  },
  questionText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 30,
    lineHeight: 28,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 20,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedOption: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  optionText: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
  },
  selectedOptionText: {
    color: '#00897B',
    fontWeight: '600',
  },
  backButton: {
    padding: 16,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  resultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 30,
  },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  scoreText: {
    fontSize: 40,
    fontWeight: '700',
    color: '#fff',
  },
  scoreLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  severityLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 40,
  },
  nextSectionButton: {
    backgroundColor: '#fff',
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  nextSectionButtonText: {
    color: '#00897B',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default IntakeFormScreen;
