import { Ionicons } from "@expo/vector-icons";
import { MotiView } from "moti";
import { StyleSheet, Text, View } from "react-native";

import Colors from "../../theme/colors";
import { RecentActivity } from "../../services/dashboard.service";

interface ActivityTimelineProps {
  activities: RecentActivity[];
}

export default function ActivityTimeline({ activities }: ActivityTimelineProps) {
  const getStatusColor = (status?: string) => {
    switch (status) {
      case "pending":
        return "#F59E0B";
      case "approved":
        return "#10B981";
      case "rejected":
        return "#EF4444";
      case "submitted":
        return "#3B82F6";
      case "draft":
        return "#6B7280";
      case "reviewing":
        return "#8B5CF6";
      default:
        return "#6B7280";
    }
  };

  const getActivityIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case "application":
        return "briefcase-outline";
      case "document":
        return "document-text-outline";
      case "journal":
        return "book-outline";
      case "dtr":
        return "calendar-outline";
      default:
        return "ellipse-outline";
    }
  };

  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    }) + ' • ' + date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (activities.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No recent activity</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {activities.slice(0, 4).map((item, index) => (
        <MotiView
          key={item.id}
          from={{ opacity: 0, translateX: -10 }}
          animate={{ opacity: 1, translateX: 0 }}
          transition={{ type: "spring", delay: index * 50 }}
          style={styles.itemContainer}
        >
          <View style={styles.leftColumn}>
            <View style={[styles.iconContainer, { backgroundColor: `${getStatusColor(item.status)}15` }]}>
              <Ionicons name={getActivityIcon(item.type)} size={18} color={getStatusColor(item.status)} />
            </View>
            {index < Math.min(activities.length, 4) - 1 && <View style={styles.timelineLine} />}
          </View>
          <View style={styles.contentColumn}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>{item.title}</Text>
              {item.status && (
                <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}15` }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.description}>{item.description}</Text>
            <Text style={styles.time}>{formatTime(item.time)}</Text>
          </View>
        </MotiView>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 4,
  },
  emptyContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  itemContainer: {
    flexDirection: 'row',
    paddingVertical: 10,
  },
  leftColumn: {
    width: 32,
    alignItems: 'center',
    marginRight: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E8EDF5',
    marginTop: -4,
    marginBottom: -4,
  },
  contentColumn: {
    flex: 1,
    paddingBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  description: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  time: {
    fontSize: 11,
    color: Colors.textSecondary,
    opacity: 0.6,
  },
});