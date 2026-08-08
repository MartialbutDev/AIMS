// src/components/CropInfo.tsx
import { Ionicons } from "@expo/vector-icons";
import { View, Text, StyleSheet } from "react-native";

interface CropInfoProps {
  cropData: {
    originX: number;
    originY: number;
    width: number;
    height: number;
  };
}

export default function CropInfo({ cropData }: CropInfoProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Ionicons name="crop-outline" size={16} color="#64748B" />
        <Text style={styles.label}>Crop Area</Text>
      </View>
      <View style={styles.grid}>
        <View style={styles.cell}>
          <Text style={styles.value}>{cropData.originX}</Text>
          <Text style={styles.label}>Left</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.value}>{cropData.originY}</Text>
          <Text style={styles.label}>Top</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.value}>{cropData.width}</Text>
          <Text style={styles.label}>Width</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.value}>{cropData.height}</Text>
          <Text style={styles.label}>Height</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  cell: {
    alignItems: 'center',
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  label: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
});