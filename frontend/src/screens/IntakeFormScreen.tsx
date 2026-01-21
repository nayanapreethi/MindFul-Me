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
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

// -------------------- QUESTIONS --------------------

const PHQ9_QUESTIONS = [
  { id: 'phq1', text: 'Over the last 2 weeks, how often have you felt:', question: 'Little interest or pleasure in doing things?' },
  { id: 'phq2', question: 'Feeling down, depressed, or hopeless?' },
  { id: 'phq3', question: 'Trouble falling or staying asleep, or sleeping too much?' },
  { id: 'phq4', question: 'Feeling tired or having little energy?' },
  { id: 'phq5', question: 'Poor appetite or overeating?' },
  { id: 'phq6', question: 'Feeling bad about yourself — or that you\'re a failure?' },
  { id: 'phq7', question: 'Trouble concentrating on things, such as reading?' },
  { id: 'phq8', question: 'Moving or speaking so slowly that others have noticed?' },
  { id: 'phq9', question: 'Thoughts that you would be better off dead or hurting yourself?' },
];

const GAD7_QUESTIONS = [
  { id: 'gad1', text: 'Over the last 2 weeks, how often have you felt:', question: 'Feeling nervous, anxious, or on edge?' },
  { id: 'gad2', question: 'Not being able to stop or control worrying?' },
  { id: 'gad3', question: 'Worrying too much about different things?' },
  { id: 'gad4', question: 'Trouble relaxing?' },
  { id: 'gad5', question: 'Being so restless that it\'s hard to sit still?' },
  { id: 'gad6', question: 'Becoming easily annoyed or irritable?' },
  { id: 'gad7', question: 'Feeling afraid, as if something awful might happen?' },
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
  const [phq9Answers, setPhq9Answers] = useState<Record<string, number>>({});
  const [gad7Answers, setGad7Answers] = useState<Record<string, number>>({});

  const handlePhq9Answer = (id: string, val: number) =>
    setPhq9Answers(prev => ({ ...prev, [id]: val }));

  const handleGad7Answer = (id: string, val: number) =>
    setGad7Answers(prev => ({ ...prev, [id]: val }));

  const calculatePhq9Score = () =>
    Object.values(phq9Answers).reduce((a, b) => a + b, 0);

  const calculateGad7Score = () =>
    Object.values(gad7Answers).reduce((a, b) => a + b, 0);

  // -------------------- FIXED PART --------------------

  const renderFrequencyOptions = (
    questionId: string,
    onAnswer: (id: string, val: number) => void
  ) => (
    <View style={styles.optionsContainer}>
      {FREQUENCY_OPTIONS.map(option => {
        const isSelected =
          questionId.startsWith('phq')
            ? phq9Answers[questionId] === option.value
            : gad7Answers[questionId] === option.value;

        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionButton,
              isSelected ? styles.selectedOption : null,
            ]}
            onPress={() => onAnswer(questionId, option.value)}
          >
            <Text
              style={[
                styles.optionText,
                isSelected ? styles.selectedOptionText : null,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // -------------------- UI FLOW --------------------

  const renderPhq9Screen = () => {
    const answered = Object.keys(phq9Answers).length;
    if (answered >= PHQ9_QUESTIONS.length) {
      setCurrentSection('gad7');
      return null;
    }

    const q = PHQ9_QUESTIONS[answered];
    return (
      <View style={styles.questionContainer}>
        {q.text && <Text style={styles.sectionSubtitle}>{q.text}</Text>}
        <Text style={styles.questionText}>{q.question}</Text>
        {renderFrequencyOptions(q.id, handlePhq9Answer)}
      </View>
    );
  };

  const renderGad7Screen = () => {
    const answered = Object.keys(gad7Answers).length;
    if (answered >= GAD7_QUESTIONS.length) {
      onComplete(calculatePhq9Score(), calculateGad7Score());
      return null;
    }

    const q = GAD7_QUESTIONS[answered];
    return (
      <View style={styles.questionContainer}>
        {q.text && <Text style={styles.sectionSubtitle}>{q.text}</Text>}
        <Text style={styles.questionText}>{q.question}</Text>
        {renderFrequencyOptions(q.id, handleGad7Answer)}
      </View>
    );
  };

  return (
    <LinearGradient colors={['#26A69A', '#00897B']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {currentSection === 'info' && (
            <TouchableOpacity style={styles.startButton} onPress={() => setCurrentSection('phq9')}>
              <Text style={styles.startButtonText}>Begin Assessment</Text>
            </TouchableOpacity>
          )}
          {currentSection === 'phq9' && renderPhq9Screen()}
          {currentSection === 'gad7' && renderGad7Screen()}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

// -------------------- STYLES --------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 20 },
  questionContainer: { justifyContent: 'center', flex: 1 },
  questionText: { fontSize: 20, color: '#fff', marginBottom: 20 },
  sectionSubtitle: { color: '#eee', marginBottom: 10 },
  optionsContainer: { gap: 12 },
  optionButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 16,
    borderRadius: 12,
  },
  selectedOption: {
    backgroundColor: '#fff',
  },
  optionText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
  },
  selectedOptionText: {
    color: '#00897B',
    fontWeight: '600',
  },
  startButton: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 30,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#00897B',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default IntakeFormScreen;
