/**
 * Onboarding Screen
 * 3-step walkthrough explaining data privacy
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  FlatList,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

const { width, height } = Dimensions.get('window');

interface OnboardingSlide {
  title: string;
  description: string;
  icon: string;
  color: string[];
}

const slides: OnboardingSlide[] = [
  {
    title: 'Your Data, Your Control',
    description: 'MindfulMe stores all your data locally on your device. Your mental health information never leaves your phone without your explicit permission.',
    icon: '🔒',
    color: ['#26A69A', '#00897B'],
  },
  {
    title: 'Private AI Analysis',
    description: 'Our advanced AI analyzes your journal entries and voice patterns locally using state-of-the-art machine learning models. No data is sent to external servers.',
    icon: '🧠',
    color: ['#5C6BC0', '#3F51B5'],
  },
  {
    title: 'Connect with Care',
    description: 'Share your progress with healthcare providers using secure, time-limited session codes. You control what data they see and for how long.',
    icon: '👨‍⚕️',
    color: ['#7E57C2', '#673AB7'],
  },
];

interface OnboardingScreenProps {
  onComplete: () => void;
  onLogin: () => void;
}

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete, onLogin }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const slidesRef = useRef<FlatList<OnboardingSlide>>(null);

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      slidesRef.current?.scrollToOffset({
        offset: width * (currentSlide + 1),
        animated: true,
      });
      setCurrentSlide(currentSlide + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <LinearGradient colors={slides[currentSlide].color} style={styles.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        <Animated.FlatList
          ref={slidesRef}
          data={slides}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          keyExtractor={(_, index) => index.toString()}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: true }
          )}
          renderItem={({ item }) => (
            <View style={styles.slide}>
              <View style={styles.iconContainer}>
                <Text style={styles.icon}>{item.icon}</Text>
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.description}>{item.description}</Text>
            </View>
          )}
        />

        <View style={styles.footer}>
          <View style={styles.pagination}>
            {slides.map((_, index) => {
              const inputRange = [
                (index - 1) * width,
                index * width,
                (index + 1) * width,
              ];
              const dotWidth = scrollX.interpolate({
                inputRange,
                outputRange: [8, 24, 8],
                extrapolate: 'clamp',
              });
              const opacity = scrollX.interpolate({
                inputRange,
                outputRange: [0.4, 1, 0.4],
                extrapolate: 'clamp',
              });

              return (
                <Animated.View
                  key={index}
                  style={[styles.dot, { width: dotWidth, opacity }]}
                />
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.nextButton}
            onPress={currentSlide === slides.length - 1 ? onComplete : handleNext}
          >
            <Text style={styles.nextButtonText}>
              {currentSlide === slides.length - 1 ? 'Get Started' : 'Next'}
            </Text>
          </TouchableOpacity>

          {currentSlide === slides.length - 1 && (
            <TouchableOpacity onPress={onLogin} style={styles.loginLink}>
              <Text style={styles.loginText}>
                Already have an account? Sign In
              </Text>
            </TouchableOpacity>
          )}
        </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  skipButton: {
    padding: 10,
  },
  skipText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontWeight: '500',
  },
  slide: {
    width,
    paddingHorizontal: 40,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  icon: {
    fontSize: 50,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 36,
  },
  description: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 10,
  },
  footer: {
    paddingHorizontal: 40,
    paddingBottom: 50,
    alignItems: 'center',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 40,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginHorizontal: 5,
  },
  nextButton: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  nextButtonText: {
    color: '#26A69A',
    fontSize: 18,
    fontWeight: '600',
  },
  loginLink: {
    marginTop: 20,
  },
  loginText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
  },
});

export default OnboardingScreen;

