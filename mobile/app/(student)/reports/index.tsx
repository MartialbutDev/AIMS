// app/(student)/reports/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
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

import Colors from "../../../src/theme/colors";

const { width } = Dimensions.get("window");

interface ReportCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  change: string;
  color: string;
  trend: "up" | "down" | "neutral";
}

interface ProgressData {
  week: string;
  applications: number;
  journals: number;
  dtr: number;
}

interface ActivityData {
  name: string;
  count: number;
  color: string;
  legendFontColor: string;
  legendFontSize: number;
}

const reportCards: ReportCardProps[] = [
  {
    icon: "briefcase-outline",
    label: "Total Applications",
    value: "12",
    change: "+3 this month",
    color: Colors.primary,
    trend: "up",
  },
  {
    icon: "book-outline",
    label: "Journals Submitted",
    value: "8",
    change: "+2 this week",
    color: "#F59E0B",
    trend: "up",
  },
  {
    icon: "calendar-outline",
    label: "DTR Completed",
    value: "45",
    change: "+12 this month",
    color: "#10B981",
    trend: "up",
  },
  {
    icon: "document-text-outline",
    label: "Documents Uploaded",
    value: "6",
    change: "2 pending",
    color: "#0EA5E9",
    trend: "neutral",
  },
];

const progressData: ProgressData[] = [
  { week: "Week 1", applications: 3, journals: 2, dtr: 5 },
  { week: "Week 2", applications: 4, journals: 3, dtr: 7 },
  { week: "Week 3", applications: 5, journals: 4, dtr: 8 },
  { week: "Week 4", applications: 6, journals: 5, dtr: 10 },
  { week: "Week 5", applications: 7, journals: 6, dtr: 12 },
  { week: "Week 6", applications: 8, journals: 7, dtr: 14 },
  { week: "Week 7", applications: 10, journals: 8, dtr: 16 },
  { week: "Week 8", applications: 12, journals: 9, dtr: 18 },
];

const activityData: ActivityData[] = [
  {
    name: "Applications",
    count: 12,
    color: Colors.primary,
    legendFontColor: Colors.textPrimary,
    legendFontSize: 12,
  },
  {
    name: "Journals",
    count: 8,
    color: "#F59E0B",
    legendFontColor: Colors.textPrimary,
    legendFontSize: 12,
  },
  {
    name: "DTR",
    count: 45,
    color: "#10B981",
    legendFontColor: Colors.textPrimary,
    legendFontSize: 12,
  },
  {
    name: "Documents",
    count: 6,
    color: "#0EA5E9",
    legendFontColor: Colors.textPrimary,
    legendFontSize: 12,
  },
];

export default function ReportsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<"week" | "month" | "semester">("month");
  const [selectedChart, setSelectedChart] = useState<"progress" | "distribution">("progress");

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setRefreshing(false);
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

  const renderReportCard = (item: ReportCardProps, index: number) => (
    <View key={index} style={styles.reportCard}>
      <View style={styles.reportCardHeader}>
        <View style={[styles.reportIconContainer, { backgroundColor: `${item.color}15` }]}>
          <Ionicons name={item.icon} size={22} color={item.color} />
        </View>
        <View style={styles.reportTrend}>
          {item.trend === "up" && (
            <Ionicons name="arrow-up-outline" size={16} color="#10B981" />
          )}
          {item.trend === "down" && (
            <Ionicons name="arrow-down-outline" size={16} color="#EF4444" />
          )}
          {item.trend === "neutral" && (
            <Ionicons name="remove-outline" size={16} color="#6B7280" />
          )}
        </View>
      </View>
      <Text style={styles.reportValue}>{item.value}</Text>
      <Text style={styles.reportLabel}>{item.label}</Text>
      <Text style={styles.reportChange}>{item.change}</Text>
    </View>
  );

  const renderProgressChart = () => {
    const chartData = {
      labels: progressData.map(d => d.week),
      datasets: [
        {
          data: progressData.map(d => d.applications),
          color: (opacity = 1) => `rgba(0, 0, 128, ${opacity})`,
          strokeWidth: 2,
        },
        {
          data: progressData.map(d => d.journals),
          color: (opacity = 1) => `rgba(245, 158, 11, ${opacity})`,
          strokeWidth: 2,
        },
        {
          data: progressData.map(d => d.dtr),
          color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
          strokeWidth: 2,
        },
      ],
      legend: ["Applications", "Journals", "DTR"],
    };

    return (
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Weekly Progress</Text>
        <LineChart
          data={chartData}
          width={width - 56}
          height={220}
          chartConfig={{
            backgroundColor: Colors.white,
            backgroundGradientFrom: Colors.white,
            backgroundGradientTo: Colors.white,
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(0, 0, 128, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: {
              borderRadius: 16,
            },
            propsForDots: {
              r: "6",
              strokeWidth: "2",
              stroke: "#000080",
            },
          }}
          bezier
          style={styles.chart}
          fromZero
          withShadow
        />
      </View>
    );
  };

  const renderDistributionChart = () => {
    return (
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Activity Distribution</Text>
        <PieChart
          data={activityData}
          width={width - 56}
          height={220}
          chartConfig={{
            color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
          }}
          accessor="count"
          backgroundColor="transparent"
          paddingLeft="15"
          absolute
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reports & Analytics</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* Period Selector */}
        <View style={styles.periodSelector}>
          <TouchableOpacity
            style={[styles.periodButton, selectedPeriod === "week" && styles.periodButtonActive]}
            onPress={() => setSelectedPeriod("week")}
          >
            <Text style={[styles.periodButtonText, selectedPeriod === "week" && styles.periodButtonTextActive]}>
              Week
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodButton, selectedPeriod === "month" && styles.periodButtonActive]}
            onPress={() => setSelectedPeriod("month")}
          >
            <Text style={[styles.periodButtonText, selectedPeriod === "month" && styles.periodButtonTextActive]}>
              Month
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodButton, selectedPeriod === "semester" && styles.periodButtonActive]}
            onPress={() => setSelectedPeriod("semester")}
          >
            <Text style={[styles.periodButtonText, selectedPeriod === "semester" && styles.periodButtonTextActive]}>
              Semester
            </Text>
          </TouchableOpacity>
        </View>

        {/* Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Overview ({getPeriodLabel(selectedPeriod)})</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>87%</Text>
              <Text style={styles.summaryLabel}>Completion Rate</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>12</Text>
              <Text style={styles.summaryLabel}>Active Tasks</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>4.5</Text>
              <Text style={styles.summaryLabel}>Avg. Rating</Text>
            </View>
          </View>
        </View>

        {/* Report Cards */}
        <View style={styles.reportGrid}>
          {reportCards.map((card, index) => renderReportCard(card, index))}
        </View>

        {/* Chart Selector */}
        <View style={styles.chartSelector}>
          <TouchableOpacity
            style={[styles.chartButton, selectedChart === "progress" && styles.chartButtonActive]}
            onPress={() => setSelectedChart("progress")}
          >
            <Ionicons 
              name="trending-up-outline" 
              size={18} 
              color={selectedChart === "progress" ? Colors.white : Colors.textSecondary} 
            />
            <Text style={[styles.chartButtonText, selectedChart === "progress" && styles.chartButtonTextActive]}>
              Progress
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chartButton, selectedChart === "distribution" && styles.chartButtonActive]}
            onPress={() => setSelectedChart("distribution")}
          >
            <Ionicons 
              name="pie-chart-outline" 
              size={18} 
              color={selectedChart === "distribution" ? Colors.white : Colors.textSecondary} 
            />
            <Text style={[styles.chartButtonText, selectedChart === "distribution" && styles.chartButtonTextActive]}>
              Distribution
            </Text>
          </TouchableOpacity>
        </View>

        {/* Chart */}
        {selectedChart === "progress" ? renderProgressChart() : renderDistributionChart()}

        {/* Export Button */}
        <TouchableOpacity style={styles.exportButton}>
          <Ionicons name="download-outline" size={20} color={Colors.white} />
          <Text style={styles.exportButtonText}>Export Report (PDF)</Text>
        </TouchableOpacity>

        <View style={styles.footerSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
    color: Colors.textPrimary,
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
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    elevation: 2,
  },

  periodButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },

  periodButtonActive: {
    backgroundColor: Colors.primary,
  },

  periodButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.textSecondary,
  },

  periodButtonTextActive: {
    color: Colors.white,
  },

  summaryCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 4,
  },

  summaryTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textPrimary,
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
    color: Colors.textPrimary,
  },

  summaryLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
  },

  reportGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  reportCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    width: (width - 52) / 2,
    marginBottom: 12,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 4,
    },
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

  reportTrend: {
    // Empty for now
  },

  reportValue: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.textPrimary,
  },

  reportLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  reportChange: {
    fontSize: 11,
    color: "#10B981",
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
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },

  chartButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },

  chartButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.textSecondary,
  },

  chartButtonTextActive: {
    color: Colors.white,
  },

  chartCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 4,
  },

  chartTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 12,
  },

  chart: {
    borderRadius: 16,
    marginLeft: -20,
  },

  exportButton: {
    flexDirection: "row",
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 4,
  },

  exportButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },

  footerSpacer: {
    height: 20,
  },
});