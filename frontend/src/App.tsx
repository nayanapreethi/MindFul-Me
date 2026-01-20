import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

// Import screens
import Dashboard from './components/Dashboard';
// import MoodLogScreen from './screens/MoodLogScreen';
// import JournalScreen from './screens/JournalScreen';
// import VoiceJournalScreen from './screens/VoiceJournalScreen';
// import MedicationsScreen from './screens/MedicationsScreen';
// import ProfileScreen from './screens/ProfileScreen';
// import LoginScreen from './screens/LoginScreen';
// import OnboardingScreen from './screens/OnboardingScreen';

// Import store
import { store } from './store';

// Navigation types
export type RootStackParamList = {
  Dashboard: undefined;
  MoodLog: undefined;
  Journal: undefined;
  VoiceJournal: undefined;
  Medications: undefined;
  Profile: undefined;
  Login: undefined;
  Onboarding: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Placeholder screens (to be implemented)
const PlaceholderScreen = () => <Dashboard />;

const App: React.FC = () => {
  return (
    <GestureHandlerRootView style={styles.container}>
      <Provider store={store}>
        <SafeAreaProvider>
          <NavigationContainer>
            <Stack.Navigator
              initialRouteName="Dashboard"
              screenOptions={{
                headerStyle: {
                  backgroundColor: '#26A69A',
                },
                headerTintColor: '#fff',
                headerTitleStyle: {
                  fontWeight: '600',
                },
                headerShadowVisible: false,
              }}
            >
              <Stack.Screen
                name="Dashboard"
                component={Dashboard}
                options={{
                  title: 'MindfulMe',
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="MoodLog"
                component={PlaceholderScreen}
                options={{ title: 'Log Mood' }}
              />
              <Stack.Screen
                name="Journal"
                component={PlaceholderScreen}
                options={{ title: 'Journal' }}
              />
              <Stack.Screen
                name="VoiceJournal"
                component={PlaceholderScreen}
                options={{ title: 'Voice Journal' }}
              />
              <Stack.Screen
                name="Medications"
                component={PlaceholderScreen}
                options={{ title: 'Medications' }}
              />
              <Stack.Screen
                name="Profile"
                component={PlaceholderScreen}
                options={{ title: 'Profile' }}
              />
              <Stack.Screen
                name="Login"
                component={PlaceholderScreen}
                options={{
                  title: 'Login',
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="Onboarding"
                component={PlaceholderScreen}
                options={{
                  title: 'Welcome',
                  headerShown: false,
                }}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </SafeAreaProvider>
      </Provider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
