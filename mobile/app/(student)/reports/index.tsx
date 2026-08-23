// app/(student)/reports/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LineChart, PieChart } from "react-native-chart-kit";

import { useTheme } from "../../../src/context/ThemeContext";
import { useAutoHideTab } from "../../../src/hooks/useAutoHideTab";
import { reportService, SummaryStats, WeeklyProgress, ActivityDistribution, RecentActivity } from "../../../src/services/report.service";

const { width } = Dimensions.get("window");

interface ReportCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  change: string;
  color: string;
  trend: "up" | "down" | "neutral";
}

export default function ReportsScreen() {
  const { colors, isDark } = useTheme();
  const { handleScroll } = useAutoHideTab();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [weeklyProgress, setWeeklyProgress] = useState<WeeklyProgress[]>([]);
  const [distribution, setDistribution] = useState<ActivityDistribution[]>([]);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<"week" | "month" | "semester">("month");
  const [selectedChart, setSelectedChart] = useState<"progress" | "distribution">("progress");

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    try {
      const [summaryData, progressData, distributionData, activityData] = await Promise.all([
        reportService.getSummary(),
        reportService.getWeeklyProgress(8),
        reportService.getActivityDistribution(),
        reportService.getRecentActivity(5),
      ]);
      
      setSummary(summaryData);
      setWeeklyProgress(progressData);
      setDistribution(distributionData);
      setActivities(activityData);
    } catch (error) {
      console.error('Error fetching report data:', error);
      Alert.alert('Error', 'Failed to load report data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchReportData();
  };

  const getPeriodLabel = (period: "week" | "month" | "semester") => {
    switch (period) {
      case "week":
        return "This Week";
      case "month":
        return "This Month";
      case "semester":
        return "This Semester";
    }
  };

  const getReportCards = (): ReportCardProps[] => {
    if (!summary) return [];
    
    return [
      {
        icon: "briefcase-outline",
        label: "Applications",
        value: summary.applications.toString(),
        change: `${summary.applications} total`,
        color: colors.primary,
        trend: summary.applications > 0 ? "up" : "neutral",
      },
      {
        icon: "calendar-outline",
        label: "DTR Records",
        value: summary.dtr_count.toString(),
        change: `${summary.total_hours}h logged`,
        color: "#10B981",
        trend: summary.dtr_count > 0 ? "up" : "neutral",
      },
      {
        icon: "book-outline",
        label: "Journals",
        value: summary.journals.toString(),
        change: `${summary.journals} submitted`,
        color: "#F59E0B",
        trend: summary.journals > 0 ? "up" : "neutral",
      },
      {
        icon: "document-text-outline",
        label: "Documents",
        value: summary.documents.toString(),
        change: `${summary.documents} uploaded`,
        color: "#0EA5E9",
        trend: summary.documents > 0 ? "up" : "neutral",
      },
    ];
  };

  const renderReportCard = (item: ReportCardProps, index: number) => (
    <View key={index} style={[styles.reportCard, { backgroundColor: colors.card }]}>
      <View style={styles.reportCardHeader}>
        <View style={[styles.reportIconContainer, { backgroundColor: `${item.color}15` }]}>
          <Ionicons name={item.icon} size={22} color={item.color} />
        </View>
        <View style={styles.reportTrend}>
          {item.trend === "up" && (
            <Ionicons name="arrow-up-outline" size={16} color="#10B981" />
          )}
          {item.trend === "neutral" && (
            <Ionicons name="remove-outline" size={16} color={colors.textSecondary} />
          )}
        </View>
      </View>
      <Text style={[styles.reportValue, { color: colors.textPrimary }]}>{item.value}</Text>
      <Text style={[styles.reportLabel, { color: colors.textSecondary }]}>{item.label}</Text>
      <Text style={[styles.reportChange, { color: "#10B981" }]}>{item.change}</Text>
    </View>
  );

  const renderProgressChart = () => {
    if (weeklyProgress.length === 0) {
      return (
        <View style={[styles.chartCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>Weekly Progress</Text>
          <View style={styles.emptyChart}>
            <Text style={[styles.emptyChartText, { color: colors.textSecondary }]}>No data available yet</Text>
            <Text style={[styles.emptyChartSubtext, { color: colors.textSecondary }]}>
              Start submitting DTR, journals, and applications to see your progress
            </Text>
          </View>
        </View>
      );
    }

    const labels = weeklyProgress.map(d => {
      const weekNum = d.week.replace('Week ', '');
      return `W${weekNum}`;
    });

    const chartData = {
      labels: labels,
      datasets: [
        {
          data: weeklyProgress.map(d => d.applications),
          color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
          strokeWidth: 2,
        },
        {
          data: weeklyProgress.map(d => d.journals),
          color: (opacity = 1) => `rgba(245, 158, 11, ${opacity})`,
          strokeWidth: 2,
        },
        {
          data: weeklyProgress.map(d => d.dtr),
          color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
          strokeWidth: 2,
        },
      ],
      legend: ["Applications", "Journals", "DTR"],
    };

    const chartConfig = {
      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
      backgroundGradientFrom: isDark ? '#1E293B' : '#FFFFFF',
      backgroundGradientTo: isDark ? '#1E293B' : '#FFFFFF',
      decimalPlaces: 0,
      color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
      labelColor: (opacity = 1) => isDark ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`,
      style: {
        borderRadius: 16,
      },
      propsForDots: {
        r: "6",
        strokeWidth: "2",
        stroke: "#2563EB",
      },
      propsForLabels: {
        fontSize: 10,
        fontWeight: '500',
      },
      formatXLabel: (value: string) => value,
    };

    return (
      <View style={[styles.chartCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>Weekly Progress</Text>
        <LineChart
          data={chartData}
          width={width - 56}
          height={240}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
          fromZero
          withShadow={false}
          withInnerLines={false}
          withOuterLines={false}
          withVerticalLabels={true}
          withHorizontalLabels={true}
          verticalLabelRotation={0}
        />
      </View>
    );
  };

  const renderDistributionChart = () => {
    if (distribution.length === 0 || distribution.every(d => d.count === 0)) {
      return (
        <View style={[styles.chartCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>Activity Distribution</Text>
          <View style={styles.emptyChart}>
            <Text style={[styles.emptyChartText, { color: colors.textSecondary }]}>No data available yet</Text>
            <Text style={[styles.emptyChartSubtext, { color: colors.textSecondary }]}>
              Start using the app to see your activity distribution
            </Text>
          </View>
        </View>
      );
    }

    const pieData = distribution.map(item => ({
      ...item,
      legendFontColor: colors.textPrimary,
      legendFontSize: 12,
    }));

    return (
      <View style={[styles.chartCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>Activity Distribution</Text>
        <PieChart
          data={pieData}
          width={width - 56}
          height={220}
          chartConfig={{
            color: (opacity = 1) => isDark ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`,
          }}
          accessor="count"
          backgroundColor="transparent"
          paddingLeft="15"
          absolute
        />
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading reports...</Text>
      </SafeAreaView>
    );
  }

  const reportCards = getReportCards();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Reports & Analytics</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <View style={[styles.periodSelector, { backgroundColor: colors.card }]}>
          {["week", "month", "semester"].map((period) => (
            <TouchableOpacity
              key={period}
              style={[
                styles.periodButton,
                selectedPeriod === period && [styles.periodButtonActive, { backgroundColor: colors.primary }],
              ]}
              onPress={() => setSelectedPeriod(period as typeof selectedPeriod)}
            >
              <Text
                style={[
                  styles.periodButtonText,
                  { color: selectedPeriod === period ? '#FFFFFF' : colors.textSecondary },
                ]}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {summary && (
          <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.summaryTitle, { color: colors.textPrimary }]}>
              Overview ({getPeriodLabel(selectedPeriod)})
            </Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
                  {summary.total_hours > 0 ? `${summary.total_hours}h` : '0h'}
                </Text>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Hours</Text>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
                  {summary.applications + summary.dtr_count + summary.journals + summary.documents}
                </Text>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Activities</Text>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
                  {summary.status_distribution?.accepted || 0}
                </Text>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Accepted Apps</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.reportGrid}>
          {reportCards.map((card, index) => renderReportCard(card, index))}
        </View>

        <View style={styles.chartSelector}>
          {["progress", "distribution"].map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.chartButton,
                { 
                  backgroundColor: selectedChart === type ? colors.primary : colors.card,
                  borderColor: selectedChart === type ? colors.primary : colors.border,
                }
              ]}
              onPress={() => setSelectedChart(type as typeof selectedChart)}
            >
              <Ionicons 
                name={type === "progress" ? "trending-up-outline" : "pie-chart-outline"} 
                size={18} 
                color={selectedChart === type ? '#FFFFFF' : colors.textSecondary} 
              />
              <Text
                style={[
                  styles.chartButtonText,
                  { color: selectedChart === type ? '#FFFFFF' : colors.textSecondary },
                ]}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {selectedChart === "progress" ? renderProgressChart() : renderDistributionChart()}

        {activities.length > 0 && (
          <View style={[styles.recentActivityCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.recentActivityTitle, { color: colors.textPrimary }]}>Recent Activity</Text>
            {activities.map((item, index) => (
              <View key={item.id} style={[styles.recentActivityItem, { borderBottomColor: colors.border }]}>
                <View style={[styles.recentActivityIcon, { backgroundColor: `${colors.primary}10` }]}>
                  <Ionicons 
                    name={item.type === 'application' ? 'briefcase-outline' : item.type === 'dtr' ? 'calendar-outline' : 'book-outline'} 
                    size={20} 
                    color={colors.primary} 
                  />
                </View>
                <View style={styles.recentActivityContent}>
                  <Text style={[styles.recentActivityTitleText, { color: colors.textPrimary }]}>{item.title}</Text>
                  <Text style={[styles.recentActivityDesc, { color: colors.textSecondary }]}>{item.description}</Text>
                  <Text style={[styles.recentActivityTime, { color: colors.textSecondary }]}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <View style={[styles.recentActivityStatus, { 
                  backgroundColor: item.status === 'approved' || item.status === 'accepted' ? '#10B98115' : '#F59E0B15' 
                }]}>
                  <Text style={[styles.recentActivityStatusText, { 
                    color: item.status === 'approved' || item.status === 'accepted' ? '#10B981' : '#F59E0B' 
                  }]}>
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.footerSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  headerRight: {
    width: 32,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  periodSelector: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  periodButtonActive: {
    backgroundColor: "#2563EB",
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  summaryCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
  },
  summaryGrid: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  summaryLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 40,
  },
  reportGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  reportCard: {
    borderRadius: 16,
    padding: 14,
    width: (width - 52) / 2,
    marginBottom: 12,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  reportCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  reportIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  reportTrend: {},
  reportValue: {
    fontSize: 22,
    fontWeight: "700",
  },
  reportLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  reportChange: {
    fontSize: 11,
    marginTop: 4,
  },
  chartSelector: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  chartButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  chartButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  chartCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
  },
  chart: {
    borderRadius: 16,
    marginLeft: -20,
  },
  emptyChart: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyChartText: {
    fontSize: 16,
    fontWeight: "600",
  },
  emptyChartSubtext: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    opacity: 0.7,
  },
  recentActivityCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  recentActivityTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
  },
  recentActivityItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  recentActivityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  recentActivityContent: {
    flex: 1,
  },
  recentActivityTitleText: {
    fontSize: 14,
    fontWeight: "500",
  },
  recentActivityDesc: {
    fontSize: 12,
  },
  recentActivityTime: {
    fontSize: 11,
    opacity: 0.7,
  },
  recentActivityStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  recentActivityStatusText: {
    fontSize: 10,
    fontWeight: "600",
  },
  footerSpacer: {
    height: 20,
  },
});