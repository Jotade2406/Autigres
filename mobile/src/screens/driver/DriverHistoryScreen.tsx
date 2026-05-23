import React, { useEffect, useState } from 'react';
import {
  View, Text, SectionList, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { Car } from 'lucide-react-native';
import { driversApi }  from '../../api/drivers.api';
import { Colors }      from '../../theme/colors';
import { Spacing }     from '../../theme/spacing';
import type { DriverTripHistoryItemDto } from '../../api/types';

// ── Date grouping helpers ─────────────────────────────────────────────────────

function parseUtc(iso: string): Date {
  return new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z');
}

function dayKey(iso: string) {
  const d = parseUtc(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function sectionTitle(iso: string): string {
  const d    = parseUtc(iso);
  const now  = new Date();
  const k    = dayKey(iso);
  if (k === dayKey(now.toISOString())) return 'Hoy';
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  if (k === dayKey(yest.toISOString())) return 'Ayer';
  return d.toLocaleDateString('es-BO', { day: 'numeric', month: 'long' });
}

function tripTime(iso: string) {
  return parseUtc(iso).toLocaleTimeString('es-BO', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

interface Section { title: string; data: DriverTripHistoryItemDto[] }

function buildSections(items: DriverTripHistoryItemDto[]): Section[] {
  const map = new Map<string, Section>();
  for (const item of items) {
    const k = dayKey(item.createdAt);
    if (!map.has(k)) map.set(k, { title: sectionTitle(item.createdAt), data: [] });
    map.get(k)!.data.push(item);
  }
  return [...map.values()];
}

// ── Trip card ─────────────────────────────────────────────────────────────────

function TripCard({ item }: { item: DriverTripHistoryItemDto }) {
  const cancelled = item.status === 'cancelled';

  return (
    <View style={S.card}>
      <View style={S.cardLeft}>
        <Car size={22} color={Colors.textLow} />
      </View>
      <View style={S.cardCenter}>
        <View style={S.cardTopRow}>
          <View style={[S.typeBadge, item.isPooled && S.typeBadgeShared]}>
            <Text style={[S.typeText, item.isPooled && S.typeTextShared]}>
              {item.isPooled ? 'Compartido' : 'Individual'}
            </Text>
          </View>
          <Text style={S.timeText}>{tripTime(item.createdAt)}</Text>
        </View>
        <Text style={S.originText} numberOfLines={1}>{item.originAddress}</Text>
        <Text style={S.destText}   numberOfLines={1}>{item.destinationAddress}</Text>
        <Text style={S.passText}>
          {item.passengerCount} pasajero{item.passengerCount !== 1 ? 's' : ''}
        </Text>
      </View>
      <View style={S.cardRight}>
        {cancelled ? (
          <>
            <Text style={S.fareCancelled}>Bs. 0</Text>
            <View style={S.cancelBadge}>
              <Text style={S.cancelBadgeText}>Cancelado</Text>
            </View>
          </>
        ) : (
          <Text style={S.fare}>Bs. {Math.round(item.fareAmount)}</Text>
        )}
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function DriverHistoryScreen() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    driversApi.getHistory()
      .then(items => setSections(buildSections(items)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={S.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={S.safe}>
      <StatusBar style="light" />
      <SectionList
        sections={sections}
        keyExtractor={item => item.tripUuid}
        contentContainerStyle={S.list}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={<Text style={S.screenTitle}>Mis viajes</Text>}
        ListEmptyComponent={
          <Text style={S.empty}>No tenés viajes anteriores.</Text>
        }
        renderSectionHeader={({ section }) => (
          <Text style={S.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => <TripCard item={item} />}
        ItemSeparatorComponent={() => <View style={S.separator} />}
      />
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, backgroundColor: Colors.bgPrimary, alignItems: 'center', justifyContent: 'center' },
  list:   { padding: Spacing.md, paddingBottom: 80 },

  screenTitle: { fontSize: 24, fontWeight: '700', color: Colors.textHigh, marginBottom: Spacing.md },
  sectionHeader: {
    fontSize: 12, fontWeight: '700', color: Colors.textLow,
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingVertical: Spacing.sm, marginTop: Spacing.sm,
  },

  card: {
    backgroundColor: Colors.surface,
    borderRadius:    16,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         Spacing.md,
    flexDirection:   'row',
    gap:             Spacing.sm,
    alignItems:      'center',
  },
  cardLeft:   { justifyContent: 'center', alignItems: 'center', width: 32 },
  cardCenter: { flex: 1, gap: 4 },
  cardRight:  { alignItems: 'flex-end', gap: 4, minWidth: 64 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },

  typeBadge: {
    borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2,
    backgroundColor: Colors.primaryDim,
  },
  typeBadgeShared: { backgroundColor: '#7C6FFF22' },
  typeText:        { fontSize: 11, fontWeight: '600', color: Colors.primary },
  typeTextShared:  { color: '#7C6FFF' },

  timeText:   { fontSize: 11, color: Colors.textLow },
  originText: { fontSize: 13, color: Colors.textMid, fontWeight: '500' },
  destText:   { fontSize: 12, color: Colors.textLow },
  passText:   { fontSize: 11, color: Colors.textLow },

  fare:           { fontSize: 16, fontWeight: '700', color: Colors.accent },
  fareCancelled:  { fontSize: 16, fontWeight: '700', color: Colors.error },
  cancelBadge:    { backgroundColor: Colors.errorDim, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  cancelBadgeText:{ fontSize: 10, fontWeight: '600', color: Colors.error },

  separator: { height: 8 },
  empty:     { textAlign: 'center', color: Colors.textLow, marginTop: 40 },
});
