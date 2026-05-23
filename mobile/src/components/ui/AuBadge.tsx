import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../theme/colors';

type BadgeColor = 'primary' | 'accent' | 'error' | 'warning';

interface AuBadgeProps {
  label: string;
  color?: BadgeColor;
  style?: ViewStyle;
}

const colorMap: Record<BadgeColor, { bg: string; text: string }> = {
  primary: { bg: Colors.primaryDim, text: Colors.primary },
  accent:  { bg: Colors.accentDim,  text: Colors.accent  },
  error:   { bg: Colors.errorDim,   text: Colors.error   },
  warning: { bg: Colors.warningDim, text: Colors.warning  },
};

export function AuBadge({ label, color = 'primary', style }: AuBadgeProps) {
  const { bg, text } = colorMap[color];
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text style={[styles.text, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
  },
});
