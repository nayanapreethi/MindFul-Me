import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { VictoryLine, VictoryChart, VictoryAxis, VictoryTheme, VictoryArea, VictoryScatter } from 'victory-native';
import { config, mlService, PredictionResult, VoiceAnalysisResult } from '../utils/config';

const { width } = Dimensions.get('window');

interface PulseMetric {
  date: string;
  mentalHealthIndex: number;
  burnoutRiskScore: number;
  vocalHealthScore?: number;
}

interface DashboardData {
  user: {
    name: string;
    mentalHealthIndex: number;
  };
  metrics: PulseMetric[];
  prediction?: PredictionResult;
  voiceAnalysis?: VoiceAnalysisResult;
  trend: 'improving' | 'stable' | 'declining';
  lastUpdate: Date;
}

interface PulseDashboardProps {
  userId: string;
  onNavigate?: (screen: string, params?: any) => void;
}

const PulseDashboard: React.FC<PulseDashboardProps> = ({ userId, onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [mlServiceHealth, setMlServiceHealth] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Check ML service health on mount
  useEffect(() => {
    checkMLServiceHealth();
  }, []);

  // Load dashboard data on mount
  useEffect(() => {
    loadDashboardData();
  }, [userId]);

  const checkMLServiceHealth = async () => {
    try {
      await mlService.checkHealth();
      setMlServiceHealth(true);
    } catch (err) {
      console.warn('ML Service unavailable:', err);
      setMlServiceHealth(false);
    }
  };

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // In a real app, this would fetch from the backend
      // For now, we'll generate mock data
      const mockMetrics = generateMockMetrics();
      const mockTrend = calculateTrend(mockMetrics);

      // If ML service is healthy, try to get predictions
      let prediction: PredictionResult | undefined;
      let voiceAnalysis: VoiceAnalysisResult | undefined;

      if (mlServiceHealth) {
        try {
          // Get predictive insights from ML service
          prediction = await mlService.getPrediction(
            mockMetrics.map(m => ({
              date: m.date,
              mentalHealthIndex: m.mentalHealthIndex,
            }))
          );
        } catch (err) {
          console.warn('Failed to get predictions:', err);
        }
      }

      setDashboardData({
        user: {
          name: 'User',
          mentalHealthIndex: mockMetrics[mockMetrics.length - 1]?.mentalHealthIndex || 50,
        },
        metrics: mockMetrics,
        prediction,
        voiceAnalysis,
        trend: mockTrend,
        lastUpdate: new Date(),
      });

      setLoading(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load dashboard data';
      setError(errorMsg);
      setLoading(false);
    }
  }, [mlServiceHealth]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboardData().finally(() => setRefreshing(false));
  }, [loadDashboardData]);

  const handleVoiceAnalysis = async (audioFile: File) => {
    try {
      const result = await mlService.analyzeVoice(audioFile);
      Alert.alert(
        'Voice Analysis Complete',
        `Vocal Health Score: ${result.vocalHealthScore}\nFlat Affect: ${(result.flatAffectScore * 100).toFixed(1)}%\nAgitated Speech: ${(result.agitatedSpeechScore * 100).toFixed(1)}%`
      );
    } catch (err) {
      Alert.alert('Error', 'Failed to analyze voice. Ensure ML service is running.');
    }
  };

  const getMentalHealthColor = (index: number): string => {
    if (index >= 70) return '#4CAF50';
    if (index >= 50) return '#8BC34A';
    if (index >= 30) return '#FFA726';
    return '#EF5350';
  };

  const getBurnoutColor = (score: number): string => {
    if (score >= 0.7) return '#EF5350';
    if (score >= 0.5) return '#FFA726';
    if (score >= 0.3) return '#FFC107';
    return '#66BB6A';
  };

  const getGradientColors = (index: number): string[] => {
    if (index >= 70) return ['#E8F5E9', '#C8E6C9', '#A5D6A7'];
    if (index >= 50) return ['#F1F8E9', '#DCEDC8', '#C5E1A5'];
    if (index >= 30) return ['#FFF3E0', '#FFE0B2', '#FFCC80'];
    return ['#FFEBEE', '#FFCDD2', '#EF9A9A'];
  };

  const getTrendIcon = (trend: string): string => {
    switch (trend) {
      case 'improving':
        return '📈';
      case 'declining':
        return '📉';
      default:
        return '➡️';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#26A69A" />
        <Text style={styles.loadingText}>Loading your wellness pulse...</Text>
        {!mlServiceHealth && (
          <Text style={styles.warningText}>
            ⚠️ ML Service unavailable - using offline data
          </Text>
        )}
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Error Loading Dashboard</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const chartData = dashboardData?.metrics.map((metric, index) => ({
    day: index + 1,
    mentalHealthIndex: metric.mentalHealthIndex,
    burnoutRiskScore: metric.burnoutRiskScore ? 100 - metric.burnoutRiskScore * 100 : 50,
  })) || [];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header Section */}
      <LinearGradient
        colors={dashboardData ? getGradientColors(dashboardData.user.mentalHealthIndex) : ['#E0F2F1', '#B2DFDB', '#80CBC4']}
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <Text style={styles.greeting}>Welcome back, {dashboardData?.user.name || 'User'}</Text>
            {!mlServiceHealth && (
              <View style={styles.offlineBadge}>
                <Text style={styles.offlineBadgeText}>📵 Offline</Text>
              </View>
            )}
          </View>

          {/* Mental Health Index Circle */}
          <View style={styles.mhiContainer}>
            <Text style={styles.mhiLabel}>Mental Health Index</Text>
            <View style={styles.mhiCircle}>
              <Text
                style={[
                  styles.mhiValue,
                  { color: getMentalHealthColor(dashboardData?.user.mentalHealthIndex || 50) },
                ]}
              >
                {dashboardData?.user.mentalHealthIndex?.toFixed(0) || '--'}
              </Text>
              <Text style={styles.mhiMax}>/100</Text>
            </View>
            <View style={styles.trendContainer}>
              <Text style={styles.trendText}>
                {getTrendIcon(dashboardData?.trend || 'stable')} {dashboardData?.trend}
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.contentContainer}>
        {/* Burnout Risk Alert */}
        {dashboardData?.prediction && (
          <View
            style={[
              styles.alertCard,
              {
                borderLeftColor: getBurnoutColor(dashboardData.prediction.burnoutRiskScore),
              },
            ]}
          >
            <Text style={styles.alertTitle}>Burnout Risk Analysis</Text>
            <View style={styles.burnoutIndicator}>
              <View style={styles.burnoutBar}>
                <View
                  style={[
                    styles.burnoutFill,
                    {
                      width: `${dashboardData.prediction.burnoutRiskScore * 100}%`,
                      backgroundColor: getBurnoutColor(dashboardData.prediction.burnoutRiskScore),
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.burnoutScore,
                  { color: getBurnoutColor(dashboardData.prediction.burnoutRiskScore) },
                ]}
              >
                {(dashboardData.prediction.burnoutRiskScore * 100).toFixed(0)}%
              </Text>
            </View>
            <Text style={styles.confidenceText}>
              Confidence: {(dashboardData.prediction.confidence * 100).toFixed(0)}%
            </Text>

            {/* Proactive Insights */}
            {dashboardData.prediction.proactiveInsights.length > 0 && (
              <View style={styles.insightsContainer}>
                <Text style={styles.insightsTitle}>Wellness Insights</Text>
                {dashboardData.prediction.proactiveInsights.slice(0, 2).map((insight, idx) => (
                  <View key={idx} style={styles.insightItem}>
                    <Text style={styles.insightText}>• {insight.message}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Mental Health Pulse Chart */}
        <Text style={styles.sectionTitle}>7-Day Mental Health Pulse</Text>
        <View style={styles.chartCard}>
          <VictoryChart theme={VictoryTheme.material} height={280} width={width - 60}>
            <VictoryAxis
              tickValues={[1, 2, 3, 4, 5, 6, 7]}
              tickFormat={['M', 'T', 'W', 'Th', 'F', 'S', 'Su']}
              style={{
                axis: { stroke: '#B0BEC5' },
                tickLabels: { fill: '#78909C', fontSize: 12 },
              }}
            />
            <VictoryAxis
              dependentAxis
              domain={[0, 100]}
              label="Health Index"
              style={{
                axis: { stroke: '#B0BEC5' },
                tickLabels: { fill: '#78909C', fontSize: 10 },
                axisLabel: { fill: '#78909C', fontSize: 12 },
              }}
            />

            {/* Mental Health Area */}
            <VictoryArea
              data={chartData}
              x="day"
              y="mentalHealthIndex"
              interpolation="catmullRom"
              style={{
                data: {
                  fill: 'rgba(76, 175, 80, 0.15)',
                  stroke: '#4CAF50',
                  strokeWidth: 2.5,
                },
              }}
            />

            {/* Mental Health Line */}
            <VictoryLine
              data={chartData}
              x="day"
              y="mentalHealthIndex"
              interpolation="catmullRom"
              style={{
                data: {
                  stroke: '#2E7D32',
                  strokeWidth: 3,
                },
              }}
            />

            {/* Burnout Risk Line */}
            <VictoryLine
              data={chartData}
              x="day"
              y="burnoutRiskScore"
              interpolation="catmullRom"
              style={{
                data: {
                  stroke: '#FF7043',
                  strokeWidth: 2,
                  strokeDasharray: '6,3',
                },
              }}
            />

            {/* Data Points */}
            <VictoryScatter
              data={chartData}
              x="day"
              y="mentalHealthIndex"
              size={4}
              style={{
                data: {
                  fill: '#2E7D32',
                  stroke: '#FFFFFF',
                  strokeWidth: 1.5,
                },
              }}
            />
          </VictoryChart>

          {/* Legend */}
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#2E7D32' }]} />
              <Text style={styles.legendText}>Mental Health Index</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FF7043', borderStyle: 'dashed' }]} />
              <Text style={styles.legendText}>Burnout Risk</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: '#E0F2F1' }]}
            onPress={() => onNavigate?.('Journal')}
          >
            <Text style={styles.actionIcon}>📝</Text>
            <Text style={styles.actionText}>Journal Entry</Text>
            <Text style={styles.actionSubtext}>Sentiment Analysis</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: '#E3F2FD' }]}
            onPress={() => onNavigate?.('VoiceJournal')}
          >
            <Text style={styles.actionIcon}>🎤</Text>
            <Text style={styles.actionText}>Voice Journal</Text>
            <Text style={styles.actionSubtext}>Vocal Biomarkers</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: '#FFF3E0' }]}
            onPress={() => onNavigate?.('Medications')}
          >
            <Text style={styles.actionIcon}>💊</Text>
            <Text style={styles.actionText}>Medications</Text>
            <Text style={styles.actionSubtext}>Track Adherence</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: '#F3E5F5' }]}
            onPress={() => onNavigate?.('Doctor')}
          >
            <Text style={styles.actionIcon}>👨‍⚕️</Text>
            <Text style={styles.actionText}>Doctor View</Text>
            <Text style={styles.actionSubtext}>Share Trends</Text>
          </TouchableOpacity>
        </View>

        {/* Key Metrics */}
        <Text style={styles.sectionTitle}>Key Metrics</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricIcon}>📊</Text>
            <Text style={styles.metricValue}>
              {dashboardData?.metrics[dashboardData.metrics.length - 1]?.mentalHealthIndex || '--'}
            </Text>
            <Text style={styles.metricLabel}>Today's Index</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricIcon}>📈</Text>
            <Text style={styles.metricValue}>
              {dashboardData?.metrics.length || '--'}
            </Text>
            <Text style={styles.metricLabel}>Days Tracked</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricIcon}>🎯</Text>
            <Text style={styles.metricValue}>
              {dashboardData?.prediction ? (100 - dashboardData.prediction.burnoutRiskScore * 100).toFixed(0) : '--'}
            </Text>
            <Text style={styles.metricLabel}>Wellness Score</Text>
          </View>
        </View>

        {/* ML Service Status */}
        <View style={[styles.statusCard, { borderLeftColor: mlServiceHealth ? '#66BB6A' : '#FF7043' }]}>
          <Text style={styles.statusTitle}>
            {mlServiceHealth ? '✓ ML Service Connected' : '⚠ ML Service Offline'}
          </Text>
          <Text style={styles.statusText}>
            {mlServiceHealth
              ? `Connected to ${config.ML_SERVICE_URL}`
              : 'Local analysis features may be limited. Ensure ML service is running on port 8000.'}
          </Text>
          {!mlServiceHealth && (
            <TouchableOpacity style={styles.retryButton} onPress={checkMLServiceHealth}>
              <Text style={styles.retryButtonText}>Reconnect</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const generateMockMetrics = (): PulseMetric[] => {
  const metrics: PulseMetric[] = [];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    const baseScore = 60 + Math.sin(i / 3) * 15 + Math.random() * 10;
    const mentalHealthIndex = Math.round(Math.max(20, Math.min(100, baseScore)));
    const burnoutRiskScore = (100 - mentalHealthIndex) / 100;

    metrics.push({
      date: date.toISOString().split('T')[0],
      mentalHealthIndex,
      burnoutRiskScore,
    });
  }

  return metrics;
};

const calculateTrend = (metrics: PulseMetric[]): 'improving' | 'stable' | 'declining' => {
  if (metrics.length < 2) return 'stable';

  const recent = metrics.slice(-3).map(m => m.mentalHealthIndex);
  const older = metrics.slice(0, 3).map(m => m.mentalHealthIndex);

  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

  if (recentAvg > olderAvg + 5) return 'improving';
  if (recentAvg < olderAvg - 5) return 'declining';
  return 'stable';
};

const checkMLServiceHealth = async () => {
  try {
    await mlService.checkHealth();
    return true;
  } catch {
    return false;
  }
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  loadingText: { marginTop: 16, fontSize: 16, color: '#78909C' },
  warningText: { marginTop: 8, fontSize: 12, color: '#FF7043' },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FAFAFA',
  },
  errorTitle: { fontSize: 20, fontWeight: '600', color: '#C62828', marginBottom: 8 },
  errorText: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24 },
  retryButton: {
    backgroundColor: '#26A69A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  headerGradient: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  headerContent: { alignItems: 'center' },
  greeting: { fontSize: 22, fontWeight: '600', color: '#00695C' },
  offlineBadge: {
    backgroundColor: 'rgba(255, 112, 67, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  offlineBadgeText: { fontSize: 12, color: '#FF7043', fontWeight: '600' },
  mhiContainer: { alignItems: 'center' },
  mhiLabel: { fontSize: 13, color: '#00796B', marginBottom: 12, fontWeight: '500' },
  mhiCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  mhiValue: { fontSize: 48, fontWeight: '700' },
  mhiMax: { fontSize: 14, color: '#78909C', marginTop: 2 },
  trendContainer: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  trendText: { fontSize: 14, color: '#00695C', fontWeight: '600', textTransform: 'capitalize' },
  contentContainer: { padding: 20 },
  alertCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 5,
  },
  alertTitle: { fontSize: 16, fontWeight: '600', color: '#E65100', marginBottom: 12 },
  burnoutIndicator: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  burnoutBar: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 12,
  },
  burnoutFill: { height: '100%', borderRadius: 4 },
  burnoutScore: { fontSize: 16, fontWeight: '700', minWidth: 45 },
  confidenceText: { fontSize: 12, color: '#5D4037', marginBottom: 12 },
  insightsContainer: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.1)' },
  insightsTitle: { fontSize: 13, fontWeight: '600', color: '#E65100', marginBottom: 8 },
  insightItem: { marginBottom: 6 },
  insightText: { fontSize: 12, color: '#5D4037', lineHeight: 18 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#37474F', marginBottom: 12, marginTop: 8 },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  chartLegend: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginVertical: 4 },
  legendDot: { width: 12, height: 12, borderRadius: 2, marginRight: 6 },
  legendText: { fontSize: 11, color: '#78909C' },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 },
  actionCard: {
    width: (width - 60) / 2,
    aspectRatio: 1.4,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  actionIcon: { fontSize: 32, marginBottom: 8 },
  actionText: { fontSize: 13, fontWeight: '600', color: '#37474F', textAlign: 'center' },
  actionSubtext: { fontSize: 10, color: '#78909C', marginTop: 4 },
  metricsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  metricIcon: { fontSize: 24, marginBottom: 8 },
  metricValue: { fontSize: 20, fontWeight: '700', color: '#26A69A' },
  metricLabel: { fontSize: 11, color: '#78909C', marginTop: 4, textAlign: 'center' },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    marginBottom: 24,
  },
  statusTitle: { fontSize: 14, fontWeight: '600', color: '#37474F', marginBottom: 8 },
  statusText: { fontSize: 12, color: '#78909C', lineHeight: 18 },
});

export default PulseDashboard;
