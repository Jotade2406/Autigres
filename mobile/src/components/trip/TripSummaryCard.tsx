import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AuCard } from '../ui/AuCard';
import { PoolingBadge } from './PoolingBadge';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import type { TripResponseDto } from '../../api/types';

interface TripSummaryCardProps {
  trip: TripResponseDto;
}

export function TripSummaryCard({ trip }: TripSummaryCardProps) {
  const eta = Math.ceil(trip.estimatedArrivalSeconds / 60);

  return (
    <AuCard style={styles.card}>
      <View style={styles.row}>
        <Text style={Typography.h3}>Viaje en curso</Text>
        {trip.isPooled && (
          <PoolingBadge passengerCount={trip.totalPassengers} compact />
        )}
      </View>

      {trip.driver && (
        <View style={styles.driverRow}>
          <Text style={[Typography.body, styles.driverName]}>
            🧑‍✈️ {trip.driver.fullName}
          </Text>
          <Text style={[Typography.caption, styles.rating]}>
            ⭐ {trip.driver.ratingAverage.toFixed(1)}
          </Text>
        </View>
      )}

      {trip.vehicle && (
        <Text style={Typography.caption}>
          {trip.vehicle.brand} {trip.vehicle.model} · {trip.vehicle.color} · {trip.vehicle.plateNumber}
        </Text>
      )}

      <View style={styles.footer}>
        <Text style={styles.fareText}>Bs. {Math.round(trip.fareAmount)}</Text>
        <Text style={Typography.caption}>ETA {eta} min</Text>
      </View>
    </AuCard>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  driverName: { flex: 1 },
  rating: { color: Colors.warning },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  fareText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.accent,
  },
});
