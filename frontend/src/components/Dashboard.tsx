import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { VictoryLine, VictoryChart, VictoryAxis, VictoryTheme, VictoryArea } from 'victory-native';

const { width } = Dimensions.get('window');

interface PredictiveInsight {
  id: string;
  type: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
  date: string;
}

interface OverviewData {
  user: {
    name: string;
    mentalHealthIndex: number;
    phq9Score: number;
    gad7Score: number;
  };
  trend: 'improving' | 'stable' | 'declining';
  recentMoodLogs: Array<{
    date: string;
    moodScore: number;
    mentalHealthIndex: number;
    anxietyLevel: number;
    stressLevel: number;
    sleepQuality: number;
  }>;
  medications: {
    scheduled: number;
    taken: number;
    missed: number;
  };
  proactiveInsights: PredictiveInsight[];
}

interface DashboardProps {
  data?: OverviewData;
  onNavigate?: (screen: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ data: propData, onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [localData, setLocalData] = useState<OverviewData | null>(null);

  const data = propData || localData;

  useEffect(() => {
    setLoading(false);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const getMentalHealthColor = (index: number): string => {
    if (index >= 70) return '#4CAF50';
    if (index >= 50) return '#8BC34A';
    if (index >= 30) return '#FFA726';
    return '#EF5350';
  };

  const getTrendIcon = (trend: string): string => {
    switch (trend) {
      case 'improving': return '📈';
      case 'declining': return '📉';
      default: return '➡️';
    }
  };

  const getGradientColors = (index: number): string[] => {
    if (index >= 70) return ['#E8F5E9', '#C8E6C9', '#A5D6A7'];
    if (index >= 50) return ['#F1F8E9', '#DCEDC8', '#C5E1A5'];
    if (index >= 30) return ['#FFF3E0', '#FFE0B2', '#FFCC80'];
    return ['#FFEBEE', '#FFCDD2', '#EF9A9A'];
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#26A69A" />
        <Text style={styles.loadingText}>Loading your wellness journey...</Text>
      </View>
    );
  }

  const chartData = data?.recentMoodLogs.map((log, index) => ({
    day: index + 1,
    mentalHealthIndex: log.mentalHealthIndex,
    predicted: log.mentalHealthIndex ? log.mentalHealthIndex + (Math.random() - 0.5) * 5 : null,
  })) || [];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <LinearGradient
        colors={data ? getGradientColors(data.user.mentalHealthIndex) : ['#E0F2F1', '#B2DFDB', '#80CBC4']}
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <Text style={styles.greeting}>Welcome back, {data?.user.name || 'User'}</Text>
          
          <View style={styles.mhiContainer}>
            <Text style={styles.mhiLabel}>Your Mental Health Index</Text>
            <View style={styles.mhiCircle}>
              <Text style={[styles.mhiValue, { color: getMentalHealthColor(data?.user.mentalHealthIndex || 50) }]}>
                {data?.user.mentalHealthIndex?.toFixed(0) || '--'}
              </Text>
            </View>
            <View style={styles.trendContainer}>
              <Text style={styles.trendText}>{getTrendIcon(data?.trend || 'stable')} {data?.trend}</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.contentContainer}>
        {data?.proactiveInsights && data.proactiveInsights.length > 0 && (
          <View style={styles.alertCard}>
            <Text style={styles.alertTitle}>Proactive Wellness Insight</Text>
            {data.proactiveInsights.map((insight) => (
              <View key={insight.id} style={styles.alertContent}>
                <Text style={styles.alertMessage}>{insight.message}</Text>
                <Text style={[styles.alertSeverity, styles[insight.severity]]}>
                  {insight.severity.toUpperCase()}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Mental Health Pulse</Text>
        <View style={styles.chartCard}>
          <VictoryChart theme={VictoryTheme.material} height={250} width={width - 60}>
            <VictoryAxis
              tickValues={[1, 2, 3, 4, 5, 6, 7]}
              tickFormat={() => ['', '', '', '', '', '', '']}
              style={{ axis: { stroke: '#B0BEC5' } }}
            />
            <VictoryAxis
              dependentAxis
              domain={[0, 100]}
              style={{ axis: { stroke: '#B0BEC5' }, tickLabels: { fill: '#78909C' } }}
            />
            <VictoryArea
              data={chartData}
              x="day"
              y="mentalHealthIndex"
              interpolation="catmullRom"
              style={{
                data: {
                  fill: 'rgba(38, 166, 154, 0.2)',
                  stroke: '#26A69A',
                  strokeWidth: 3,
                },
              }}
            />
            <VictoryLine
              data={chartData}
              x="day"
              y="predicted"
              interpolation="catmullRom"
              style={{
                data: {
                  stroke: '#FF7043',
                  strokeWidth: 2,
                  strokeDasharray: '5,5',
                },
              }}
            />
          </VictoryChart>
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#26A69A' }]} />
              <Text style={styles.legendText}>Current State</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FF7043' }]} />
              <Text style={styles.legendText}>Predicted</Text>
            </View>
          </View>
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: '#E0F2F1' }]}
            onPress={() => onNavigate?.('MoodLog')}
          >
            <Text style={styles.actionIcon}>😊</Text>
            <Text style={styles.actionText}>Log Mood</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: '#E3F2FD' }]}
            onPress={() => onNavigate?.('VoiceJournal')}
          >
            <Text style={styles.actionIcon}>🎤</Text>
            <Text style={styles.actionText}>Voice Journal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: '#FFF3E0' }]}
            onPress={() => onNavigate?.('Journal')}
          >
            <Text style={styles.actionIcon}>📔</Text>
            <Text style={styles.actionText}>Journal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: '#F3E5F5' }]}
            onPress={() => onNavigate?.('Medications')}
          >
            <Text style={styles.actionIcon}>💊</Text>
            <Text style={styles.actionText}>Medications</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{data?.medications.taken || 0}/{data?.medications.scheduled || 0}</Text>
            <Text style={styles.statLabel}>Meds Today</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{data?.user.phq9Score || '--'}</Text>
            <Text style={styles.statLabel}>PHQ-9</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{data?.user.gad7Score || '--'}</Text>
            <Text style={styles.statLabel}>GAD-7</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#78909C' },
  headerGradient: { paddingVertical: 40, paddingHorizontal: 24, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  headerContent: { alignItems: 'center' },
  greeting: { fontSize: 24, fontWeight: '600', color: '#00695C', marginBottom: 24 },
  mhiContainer: { alignItems: 'center' },
  mhiLabel: { fontSize: 14, color: '#00796B', marginBottom: 12 },
  mhiCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  mhiValue: { fontSize: 36, fontWeight: '700' },
  trendContainer: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 20 },
  trendText: { fontSize: 14, color: '#00695C', textTransform: 'capitalize' },
  contentContainer: { padding: 20 },
  alertCard: { backgroundColor: '#FFF3E0', borderRadius: 16, padding: 16, marginBottom: 20, borderLeftWidth: 4, borderLeftColor: '#FF7043' },
  alertTitle: { fontSize: 16, fontWeight: '600', color: '#E65100', marginBottom: 8 },
  alertContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  alertMessage: { flex: 1, fontSize: 14, color: '#5D4037' },
  alertSeverity: { fontSize: 10, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  high: { backgroundColor: '#FFCDD2', color: '#C62828' },
  medium: { backgroundColor: '#FFE0B2', color: '#EF6C00' },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: '#37474F', marginBottom: 16 },
  chartCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  chartLegend: { flexDirection: 'row', justifyContent: 'center', marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16 },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  legendText: { fontSize: 12, color: '#78909C' },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  actionCard: { width: (width - 60) / 2, aspectRatio: 1.5, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  actionIcon: { fontSize: 28, marginBottom: 8 },
  actionText: { fontSize: 14, fontWeight: '500', color: '#455A64' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, flex: 1, marginHorizontal: 4, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  statValue: { fontSize: 24, fontWeight: '700', color: '#26A69A' },
  statLabel: { fontSize: 12, color: '#78909C', marginTop: 4 },
});

export default Dashboard;

