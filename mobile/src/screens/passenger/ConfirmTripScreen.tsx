import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { StatusBar }      from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LatLng }    from 'react-native-maps';
import { Car, Users, Info, Banknote, QrCode } from 'lucide-react-native';
import { AuMap }          from '../../components/map/AuMap';
import { tripsApi }               from '../../api/trips.api';
import { getRouteInfo, estimateFare } from '../../services/directions';
import { Colors }         from '../../theme/colors';
import { Spacing }        from '../../theme/spacing';
import type { PassengerStackParamList } from '../../navigation/PassengerNavigator';
import type { WaypointDto } from '../../api/types';

type Props = NativeStackScreenProps<PassengerStackParamList, 'ConfirmTrip'>;
type TripMode = 'individual' | 'shared';

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  bg:         Colors.bgPrimary,
  surf:       Colors.surface,
  card:       Colors.card,
  border:     Colors.border,
  primary:    Colors.primary,
  primaryDim: Colors.primaryDim,
  accent:     Colors.accent,
  accentDim:  Colors.accentDim,
  error:      Colors.error,
  hi:         Colors.textHigh,
  mid:        Colors.textMid,
  lo:         Colors.textLow,
  xs: Spacing.xs, sm: Spacing.sm, md: Spacing.md, lg: Spacing.lg,
} as const;

function shadow(size: 'sm' | 'md' = 'md') {
  const cfg = { sm: { e: 4, r: 4, o: 0.18 }, md: { e: 8, r: 8, o: 0.25 } }[size];
  return { shadowColor: '#000' as const, shadowOffset: { width: 0, height: cfg.e / 2 }, shadowOpacity: cfg.o, shadowRadius: cfg.r, elevation: cfg.e };
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function ConfirmTripScreen({ route, navigation }: Props) {
  const { originLat, originLng, originAddress, destLat, destLng, destAddress } = route.params;

  const [polyline, setPolyline]       = useState<LatLng[]>([]);
  const [baseFare, setBaseFare]       = useState<number | null>(null);
  const [eta, setEta]                 = useState<number | null>(null);
  const [fetching, setFetching]       = useState(true);
  const [loading, setLoading]         = useState(false);
  const [tripMode, setTripMode]       = useState<TripMode>('individual');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qr'>('cash');

  const routeWaypoints = useMemo<WaypointDto[]>(() => [
    { lat: originLat, lng: originLng, waypointType: 'pickup' },
    { lat: destLat,   lng: destLng,   waypointType: 'dropoff' },
  ], [originLat, originLng, destLat, destLng]);

  useEffect(() => {
    const origin      = { latitude: originLat, longitude: originLng };
    const destination = { latitude: destLat,   longitude: destLng   };

    getRouteInfo(origin, destination).then(info => {
      setPolyline(info.polyline);
      setBaseFare(estimateFare(info.distanceKm, info.durationMinutes));
      setEta(Math.ceil(info.durationMinutes));
    }).finally(() => setFetching(false));
  }, [originLat, originLng, destLat, destLng]);

  const isShared    = tripMode === 'shared';
  const sharedFare  = baseFare != null ? Math.round(baseFare * 0.7) : null;
  const displayFare = isShared ? sharedFare : baseFare;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const request = await tripsApi.createRequest({
        originLat, originLng, originAddress,
        destinationLat: destLat, destinationLng: destLng,
        destinationAddress: destAddress,
        isPoolingAllowed: isShared,
        estimatedFare: displayFare ?? undefined,
        paymentMethod,
      });
      navigation.replace('Matching', {
        requestUuid:   request.uuid,
        routePolyline: polyline.length >= 2 ? polyline : undefined,
        originAddress,
        destAddress,
        estimatedFare: displayFare ?? undefined,
        isShared: isShared,
      });
    } catch {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={S.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />

      {/* Map — top 50% */}
      <AuMap waypoints={routeWaypoints} polyline={polyline} style={S.map} />

      {/* Bottom sheet */}
      <ScrollView
        style={S.sheet}
        contentContainerStyle={S.sheetContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Route summary card */}
        <View style={[S.card, shadow('sm')]}>
          <Text style={S.cardTitle}>Resumen del viaje</Text>

          <View style={S.routeRow}>
            <View style={S.routeTrack}>
              <View style={[S.routeDot, { backgroundColor: T.accent }]} />
              <View style={S.routeLine} />
              <View style={[S.routeDot, { backgroundColor: T.error }]} />
            </View>
            <View style={S.routeAddresses}>
              <Text style={S.addrText} numberOfLines={2}>{originAddress}</Text>
              <Text style={S.addrText} numberOfLines={2}>{destAddress}</Text>
            </View>
          </View>

          <View style={S.hairline} />

          {fetching ? (
            <ActivityIndicator color={T.primary} style={{ marginVertical: 8 }} />
          ) : (
            <View style={S.statsRow}>
              <View style={S.statBlock}>
                <Text style={S.fareText}>
                  {displayFare != null ? `Bs. ${Math.round(displayFare)}` : '—'}
                </Text>
                <Text style={S.statLabel}>Tarifa estimada</Text>
              </View>
              {eta != null && (
                <>
                  <View style={S.statDivider} />
                  <View style={S.statBlock}>
                    <Text style={S.etaText}>{eta} min</Text>
                    <Text style={S.statLabel}>ETA estimado</Text>
                  </View>
                </>
              )}
            </View>
          )}
        </View>

        {/* Trip mode selector */}
        <Text style={S.sectionLabel}>Tipo de viaje</Text>
        <View style={S.modeRow}>

          {/* Individual */}
          <TouchableOpacity
            style={[S.modeCard, tripMode === 'individual' && S.modeCardActive]}
            onPress={() => setTripMode('individual')}
            activeOpacity={0.8}
          >
            <Car size={24} color={tripMode === 'individual' ? T.hi : T.mid} />
            <Text style={[S.modeName, tripMode === 'individual' && S.modeNameActive]}>
              Individual
            </Text>
            <Text style={S.modeDesc}>Solo vos, tarifa completa</Text>
            {baseFare != null && (
              <Text style={[S.modeFare, tripMode === 'individual' && { color: T.hi }]}>
                Bs. {Math.round(baseFare)}
              </Text>
            )}
          </TouchableOpacity>

          {/* Shared */}
          <TouchableOpacity
            style={[S.modeCard, tripMode === 'shared' && S.modeCardSharedActive]}
            onPress={() => setTripMode('shared')}
            activeOpacity={0.8}
          >
            <Users size={24} color={tripMode === 'shared' ? T.accent : T.mid} />
            <Text style={[S.modeName, tripMode === 'shared' && S.modeNameShared]}>
              Compartido
            </Text>
            <Text style={S.modeDesc}>Compartí ruta y ahorrá</Text>
            {sharedFare != null && (
              <View style={S.sharedFareRow}>
                <Text style={[S.modeFare, tripMode === 'shared' && { color: T.accent }]}>
                  Bs. {Math.round(sharedFare)}
                </Text>
                <View style={S.savingsBadge}>
                  <Text style={S.savingsText}>-30%</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>

        </View>

        {/* Shared trip info */}
        {isShared && (
          <View style={[S.infoBox, shadow('sm')]}>
            <Info size={14} color={T.accent} style={{ marginTop: 1 }} />
            <Text style={S.infoText}>
              Tu solicitud se combinará con otro pasajero si ambos aceptan compartir ruta y
              división de tarifa. Podés ir como viaje individual si no se encuentra match.
            </Text>
          </View>
        )}

        {/* Payment method selector */}
        <Text style={S.sectionLabel}>Método de pago</Text>
        <View style={S.modeRow}>
          <TouchableOpacity
            style={[S.modeCard, paymentMethod === 'cash' && S.modeCardActive]}
            onPress={() => setPaymentMethod('cash')}
            activeOpacity={0.8}
          >
            <Banknote size={24} color={paymentMethod === 'cash' ? T.hi : T.mid} />
            <Text style={[S.modeName, paymentMethod === 'cash' && S.modeNameActive]}>Efectivo</Text>
            <Text style={S.modeDesc}>Pagás al conductor</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[S.modeCard, paymentMethod === 'qr' && S.modeCardActive]}
            onPress={() => setPaymentMethod('qr')}
            activeOpacity={0.8}
          >
            <QrCode size={24} color={paymentMethod === 'qr' ? T.hi : T.mid} />
            <Text style={[S.modeName, paymentMethod === 'qr' && S.modeNameActive]}>QR</Text>
            <Text style={S.modeDesc}>Escaneás el QR del conductor</Text>
          </TouchableOpacity>
        </View>

        {/* Actions */}
        <TouchableOpacity
          style={[S.confirmBtn, (loading || fetching || displayFare == null) && S.btnDisabled]}
          onPress={handleConfirm}
          disabled={loading || fetching || displayFare == null}
          activeOpacity={0.8}
        >
          {loading
            ? <ActivityIndicator color="#FFF" size="small" />
            : <Text style={S.confirmBtnText}>
                {fetching ? 'Calculando tarifa...' : 'Confirmar viaje'}
              </Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={S.cancelBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={S.cancelBtnText}>Cancelar</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: T.bg },
  map:   { flex: 0.45 },
  sheet: { flex: 0.55 },
  sheetContent: {
    padding:    T.md,
    gap:        T.sm,
    paddingBottom: T.lg,
  },

  // Route card
  card: {
    backgroundColor: T.card,
    borderRadius:    16,
    borderWidth:     1,
    borderColor:     T.border,
    padding:         T.md,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: T.hi, marginBottom: T.sm },
  routeRow:  { flexDirection: 'row', alignItems: 'stretch', gap: 12, marginBottom: T.sm },
  routeTrack:{ alignItems: 'center', paddingVertical: 2 },
  routeDot:  { width: 10, height: 10, borderRadius: 5 },
  routeLine: { width: 2, flex: 1, minHeight: 16, backgroundColor: T.border, marginVertical: 3 },
  routeAddresses: { flex: 1, justifyContent: 'space-between', gap: 10 },
  addrText:  { fontSize: 13, color: T.mid, lineHeight: 18 },
  hairline:  { height: 1, backgroundColor: T.border, marginVertical: T.sm },
  statsRow:  { flexDirection: 'row', alignItems: 'center', gap: T.md },
  statBlock: { gap: 2 },
  fareText:  { fontSize: 24, fontWeight: '700', color: T.accent },
  statDivider: { width: 1, height: 32, backgroundColor: T.border },
  etaText:   { fontSize: 20, fontWeight: '600', color: T.hi },
  statLabel: { fontSize: 11, color: T.lo, fontWeight: '500' },

  // Mode selector
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: T.lo,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginTop: T.xs,
  },
  modeRow:  { flexDirection: 'row', gap: T.sm },
  modeCard: {
    flex: 1, alignItems: 'center', gap: 4,
    backgroundColor: T.surf, borderRadius: 16,
    borderWidth: 1.5, borderColor: T.border,
    paddingVertical: T.md, paddingHorizontal: T.sm,
  },
  modeCardActive:       { borderColor: T.primary, backgroundColor: T.primaryDim },
  modeCardSharedActive: { borderColor: T.accent,  backgroundColor: T.accentDim  },
  modeName:             { fontSize: 13, fontWeight: '700', color: T.mid },
  modeNameActive:       { color: T.hi },
  modeNameShared:       { color: T.accent },
  modeDesc:             { fontSize: 11, color: T.lo, textAlign: 'center' },
  modeFare:             { fontSize: 15, fontWeight: '700', color: T.lo, marginTop: 2 },
  sharedFareRow:        { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  savingsBadge: {
    backgroundColor: T.accent, borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  savingsText: { fontSize: 10, fontWeight: '800', color: '#000' },

  // Info box
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: T.sm,
    backgroundColor: T.accentDim, borderRadius: 12,
    borderWidth: 1, borderColor: T.accent,
    padding: T.sm,
  },
  infoText: { flex: 1, fontSize: 12, color: T.mid, lineHeight: 17 },

  // Buttons
  confirmBtn: {
    backgroundColor: T.primary, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled:    { opacity: 0.5 },
  confirmBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  cancelBtn:      { alignItems: 'center', paddingVertical: T.sm },
  cancelBtnText:  { fontSize: 15, fontWeight: '500', color: T.lo },
});
