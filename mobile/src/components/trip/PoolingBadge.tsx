import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../theme/colors';

interface PoolingBadgeProps {
  passengerCount?: number;
  compact?: boolean;
  style?: ViewStyle;
}

export function PoolingBadge({ passengerCount, compact = false, style }: PoolingBadgeProps) {
  const label = compact
    ? `👥 ${passengerCount ?? ''}`
    : `👥 Viaje compartido${passengerCount ? ` · ${passengerCount} pasajeros` : ''}`;

  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: Colors.primaryDim,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  text: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '500',
  },
});
