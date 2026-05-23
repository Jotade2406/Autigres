import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { Car, Crown, X, Check } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuMap }   from '../../components/map/AuMap';
import { Colors }  from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import type { WaypointDto } from '../../api/types';
import type { PassengerStackParamList } from '../../navigation/PassengerNavigator';

type Props = NativeStackScreenProps<PassengerStackParamList, 'CancelledTrip'>;

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  bg:         Colors.bgPrimary,
  surf:       Colors.surface,
  card:       Colors.card,
  border:     Colors.border,
  primary:    Colors.primary,
  primaryDim: Colors.primaryDim,
  accent:     Colors.accent,
  error:      Colors.error,
  errorDim:   Colors.errorDim,
  hi:         Colors.textHigh,
  mid:        Colors.textMid,
  lo:         Colors.textLow,
  xs: Spacing.xs, sm: Spacing.sm, md: Spacing.md, lg: Spacing.lg,
} as const;

// ── Service options (hardcoded for demo) ──────────────────────────────────────

type IconComponent = React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;

const SERVICE_OPTIONS: readonly {
  id: string; label: string; multiplier: number;
  Icon: IconComponent; desc: string;
}[] = [
  { id: 'economico', label: 'Económico', multiplier: 1.00, Icon: Car,   desc: 'El más accesible'        },
  { id: 'confort',   label: 'Confort',   multiplier: 1.35, Icon: Car,   desc: 'Más espacio y comodidad' },
  { id: 'premium',   label: 'Premium',   multiplier: 1.75, Icon: Crown, desc: 'Experiencia top'          },
] as const;

type ServiceId = typeof SERVICE_OPTIONS[number]['id'];

// ── Constants ─────────────────────────────────────────────────────────────────

const { height: SCREEN_H } = Dimensions.get('window');
const MAP_H  = Math.round(SCREEN_H * 0.38);
const FIT_PAD = { top: 52, right: 52, bottom: 52, left: 52 };

// ── Screen ────────────────────────────────────────────────────────────────────

export function CancelledTripScreen({ route, navigation }: Props) {
  const {
    routePolyline = [], originAddress = '', destAddress = '', estimatedFare,
  } = route.params;

  const [selectedId, setSelectedId] = useState<ServiceId>('economico');

  // ── Map data ──────────────────────────────────────────────────────────────

  const hasRoute = routePolyline.length >= 2;

  const waypoints: WaypointDto[] = hasRoute ? [
    { lat: routePolyline[0].latitude,                        lng: routePolyline[0].longitude,                        waypointType: 'pickup'  },
    { lat: routePolyline[routePolyline.length - 1].latitude, lng: routePolyline[routePolyline.length - 1].longitude, waypointType: 'dropoff' },
  ] : [];

  const mapCoords = hasRoute
    ? routePolyline.map(p => ({ latitude: p.latitude, longitude: p.longitude }))
    : undefined;

  // ── Navigation helpers ────────────────────────────────────────────────────

  const originLat = hasRoute ? routePolyline[0].latitude  : undefined;
  const originLng = hasRoute ? routePolyline[0].longitude : undefined;
  const destLat   = hasRoute ? routePolyline[routePolyline.length - 1].latitude  : undefined;
  const destLng   = hasRoute ? routePolyline[routePolyline.length - 1].longitude : undefined;

  const handleRequestAgain = () => {
    if (originLat == null || originLng == null || destLat == null || destLng == null) {
      navigation.navigate('Tabs');
      return;
    }
    navigation.navigate('ConfirmTrip', {
      originLat, originLng, originAddress,
      destLat,   destLng,   destAddress,
      initialServiceTier: selectedId,
    });
  };

  // ── Fare calculation ──────────────────────────────────────────────────────

  const selectedOpt  = SERVICE_OPTIONS.find(o => o.id === selectedId)!;
  const selectedFare = estimatedFare != null
    ? estimatedFare * selectedOpt.multiplier
    : null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={S.root}>
      <StatusBar style="light" />

      {/* Map — fixed height top section */}
      <View style={S.mapWrap}>
        <AuMap
          waypoints={waypoints}
          polyline={mapCoords}
          fitToCoords={mapCoords}
          fitPadding={FIT_PAD}
          style={StyleSheet.absoluteFill}
        />
        {/* Cancelled badge over the map */}
        <SafeAreaView edges={['top']} style={S.badgeOuter}>
          <View style={S.cancelledBadge}>
            <X size={13} color={T.error} strokeWidth={2.5} />
            <Text style={S.cancelledBadgeText}>Viaje cancelado</Text>
          </View>
        </SafeAreaView>
      </View>

      {/* Scrollable info */}
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={S.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Route card */}
          <View style={S.routeCard}>
            <View style={S.routeRow}>
              <View style={S.routeTrack}>
                <View style={[S.routeDot, { backgroundColor: T.accent }]} />
                <View style={S.routeLine} />
                <View style={[S.routeDot, { backgroundColor: T.error }]} />
              </View>
              <View style={S.routeAddresses}>
                <Text style={S.routeAddr} numberOfLines={2}>{originAddress || 'Origen'}</Text>
                <Text style={S.routeAddr} numberOfLines={2}>{destAddress  || 'Destino'}</Text>
              </View>
            </View>

            {estimatedFare != null && (
              <View style={S.fareRow}>
                <Text style={S.fareLabel}>Tarifa que hubiera sido</Text>
                <Text style={S.fareAmt}>Bs. {Math.round(estimatedFare)}</Text>
              </View>
            )}
          </View>

          {/* Service options */}
          <Text style={S.sectionTitle}>Opciones de servicio</Text>

          {SERVICE_OPTIONS.map(opt => {
            const fare     = estimatedFare != null ? Math.round(estimatedFare * opt.multiplier) : null;
            const selected = selectedId === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[S.serviceCard, selected && S.serviceCardOn]}
                onPress={() => setSelectedId(opt.id)}
                activeOpacity={0.8}
              >
                <opt.Icon size={24} color={selected ? T.primary : T.mid} strokeWidth={1.5} />
                <View style={{ flex: 1 }}>
                  <Text style={[S.serviceLabel, selected && S.serviceLabelOn]}>{opt.label}</Text>
                  <Text style={S.serviceDesc}>{opt.desc}</Text>
                </View>
                {fare && (
                  <Text style={[S.serviceFare, selected && S.serviceFareOn]}>Bs. {fare}</Text>
                )}
                {selected && <Check size={15} color={T.primary} strokeWidth={2.5} />}
              </TouchableOpacity>
            );
          })}

          {/* Actions */}
          <TouchableOpacity
            style={S.primaryBtn}
            onPress={handleRequestAgain}
            activeOpacity={0.85}
          >
            <Text style={S.primaryBtnText}>
              {selectedFare != null
                ? `Pedir de nuevo · Bs. ${Math.round(selectedFare)}`
                : 'Pedir de nuevo'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={S.ghostBtn}
            onPress={() => navigation.navigate('Tabs')}
            activeOpacity={0.7}
          >
            <Text style={S.ghostBtnText}>Volver al inicio</Text>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },

  // Map section
  mapWrap:    { height: MAP_H, overflow: 'hidden' },
  badgeOuter: { alignItems: 'center' },
  cancelledBadge: {
    marginTop:       T.sm,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             5,
    backgroundColor: T.errorDim,
    borderRadius:    20,
    borderWidth:     1,
    borderColor:     T.error + '60',
    paddingHorizontal: 14,
    paddingVertical:    7,
  },
  cancelledBadgeText: { fontSize: 13, fontWeight: '700', color: T.error },

  // Scroll content
  scrollContent: { padding: T.md, gap: T.md, paddingBottom: T.lg },

  // Route card
  routeCard: {
    backgroundColor: T.surf,
    borderRadius:    16,
    borderWidth:     1,
    borderColor:     T.border,
    padding:         T.md,
    gap:             T.md,
  },
  routeRow:       { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  routeTrack:     { alignItems: 'center', paddingVertical: 2 },
  routeDot:       { width: 10, height: 10, borderRadius: 5 },
  routeLine:      { width: 1.5, flex: 1, minHeight: 14, backgroundColor: T.border, marginVertical: 3 },
  routeAddresses: { flex: 1, justifyContent: 'space-between', gap: 8 },
  routeAddr:      { fontSize: 14, color: T.mid, lineHeight: 19 },
  fareRow:        { borderTopWidth: 1, borderTopColor: T.border, paddingTop: T.sm, gap: 2 },
  fareLabel:      { fontSize: 12, color: T.lo, fontWeight: '500' },
  fareAmt:        { fontSize: 24, fontWeight: '900', color: T.accent, fontVariant: ['tabular-nums'] as any },

  // Section header
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: T.lo,
    textTransform: 'uppercase' as any, letterSpacing: 0.8,
  },

  // Service cards
  serviceCard: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             T.sm,
    backgroundColor: T.surf,
    borderRadius:    14,
    borderWidth:     1.5,
    borderColor:     T.border,
    padding:         T.md,
  },
  serviceCardOn:   { borderColor: T.primary, backgroundColor: T.primaryDim },
  serviceLabel:    { fontSize: 15, fontWeight: '600', color: T.hi },
  serviceLabelOn:  { color: T.primary },
  serviceDesc:     { fontSize: 12, color: T.lo, marginTop: 2 },
  serviceFare:     { fontSize: 15, fontWeight: '700', color: T.mid },
  serviceFareOn:   { color: T.primary },

  // Buttons
  primaryBtn: {
    backgroundColor: T.primary,
    borderRadius:    16,
    paddingVertical: 16,
    alignItems:      'center',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  ghostBtn: {
    backgroundColor: T.surf,
    borderRadius:    16,
    paddingVertical: 14,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     T.border,
  },
  ghostBtnText: { fontSize: 15, fontWeight: '600', color: T.mid },
});
