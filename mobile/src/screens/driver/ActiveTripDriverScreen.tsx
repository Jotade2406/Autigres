import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LatLng }    from 'react-native-maps';
import { Car, Users, Flag, QrCode, Banknote, XCircle, CheckCircle, Check, Crown } from 'lucide-react-native';
import { AuMap }          from '../../components/map/AuMap';
import { TigrecitoLayer } from '../../components/map/TigrecitoLayer';
import { SwipeButton }    from '../../components/ui/SwipeButton';
import { driversApi }     from '../../api/drivers.api';
import { tripsApi }       from '../../api/trips.api';
import { getRouteInfo }   from '../../services/directions';
import { Colors }         from '../../theme/colors';
import { Typography }     from '../../theme/typography';
import { Spacing }        from '../../theme/spacing';
import type { TripPassengerSummaryDto, TripResponseDto, WaypointDto } from '../../api/types';
import type { DriverStackParamList } from '../../navigation/DriverNavigator';

type Props = NativeStackScreenProps<DriverStackParamList, 'ActiveTripDriver'>;

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
  errorDim:   Colors.errorDim,
  warning:    Colors.warning,
  hi:         Colors.textHigh,
  mid:        Colors.textMid,
  lo:         Colors.textLow,
  xs: Spacing.xs, sm: Spacing.sm, md: Spacing.md, lg: Spacing.lg,
} as const;

function shadow(size: 'sm' | 'md' | 'lg' = 'md') {
  const cfg = { sm: { e: 4, r: 4, o: 0.20 }, md: { e: 8, r: 8, o: 0.25 }, lg: { e: 16, r: 12, o: 0.35 } }[size];
  return { shadowColor: '#000' as const, shadowOffset: { width: 0, height: cfg.e / 2 }, shadowOpacity: cfg.o, shadowRadius: cfg.r, elevation: cfg.e };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const POLL_MS   = 8_000;
const SHEET_H   = Math.round(Dimensions.get('window').height * 0.62);
const FREE_WAIT = 180; // 3 minutes free waiting
const MAP_PAD   = { top: 80, right: 40, bottom: SHEET_H + 20, left: 40 };

const STATUS_LABEL: Record<string, string> = {
  waiting:     'Esperando recogida',
  picked_up:   'A bordo',
  dropped_off: 'Completado',
  cancelled:   'Cancelado',
  no_show:     'No se presentó',
};
const STATUS_COLOR: Record<string, string> = {
  waiting:   T.warning,
  picked_up: T.primary,
};
const DONE = ['dropped_off', 'no_show', 'cancelled'];

// ── PassengerWaitCard ─────────────────────────────────────────────────────────

function PassengerWaitCard({ passenger, arrivedAt, onPickup, busy, tick: _ }: {
  passenger: TripPassengerSummaryDto;
  arrivedAt: number;
  onPickup: () => void;
  busy: boolean;
  tick: number;
}) {
  const elapsed     = Math.floor((Date.now() - arrivedAt) / 1000);
  const secondsLeft = Math.max(0, FREE_WAIT - elapsed);
  const isLate      = secondsLeft < 60;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const initials = passenger.fullName
    .split(' ')
    .slice(0, 2)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase();

  return (
    <View style={PW.card}>
      <View style={[PW.avatar, { backgroundColor: isLate ? '#FFB34730' : T.primaryDim }]}>
        <Text style={[PW.avatarText, { color: isLate ? T.warning : T.primary }]}>{initials}</Text>
      </View>
      <Text style={PW.name}>{passenger.fullName}</Text>
      <Text style={PW.waiting}>Esperando recogida</Text>
      <Text style={[PW.timer, isLate && PW.timerLate]}>{mm}:{ss}</Text>
      {isLate && <Text style={PW.lateHint}>El tiempo libre está por agotarse</Text>}
      <TouchableOpacity
        style={[PW.btn, busy && PW.btnDisabled]}
        onPress={onPickup}
        disabled={busy}
        activeOpacity={0.85}
      >
        {busy
          ? <ActivityIndicator color={T.hi} size="small" />
          : <View style={PW.btnInner}>
              <Text style={PW.btnText}>Pasajero subió</Text>
              <Check size={14} color={T.hi} />
            </View>
        }
      </TouchableOpacity>
    </View>
  );
}

const PW = StyleSheet.create({
  card:        { backgroundColor: T.surf, borderRadius: 16, borderWidth: 1.5, borderColor: '#FFB34780', padding: T.md, alignItems: 'center', gap: T.sm },
  avatar:      { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { fontSize: 24, fontWeight: '800' },
  name:        { fontSize: 17, fontWeight: '700', color: T.hi, textAlign: 'center' },
  waiting:     { fontSize: 13, color: T.mid },
  timer:       { fontSize: 52, fontWeight: '900', color: T.hi, fontVariant: ['tabular-nums'], letterSpacing: 2 },
  timerLate:   { color: T.warning },
  lateHint:    { fontSize: 11, color: '#FFB347', textAlign: 'center' },
  btn:         { width: '100%', backgroundColor: T.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnInner:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btnText:     { fontSize: 15, fontWeight: '700', color: T.hi },
});

// ── ETA display ────────────────────────────────────────────────────────────────

function fmtEta(seconds: number): string {
  if (seconds <= 0) return '¡Llegando!';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m} min ${s}s` : `${s}s`;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function ActiveTripDriverScreen({ route, navigation }: Props) {
  const { tripUuid } = route.params;

  const [trip, setTrip]           = useState<TripResponseDto | null>(null);
  const [loading, setLoading]     = useState(true);
  const [busy, setBusy]           = useState(false);
  const [cancelled, setCancelled] = useState(false);

  // Map route
  const [routePolyline, setRoutePolyline] = useState<LatLng[]>([]);
  const [mapWaypoints,  setMapWaypoints]  = useState<WaypointDto[]>([]);
  const [tigrecitoPoly, setTigrecitoPoly] = useState<LatLng[]>([]);
  const [tigrecitoSecs, setTigrecitoSecs] = useState(0);

  // Wait timer (per passenger UUID → arrival timestamp)
  const arrivedAtMap   = useRef<Map<string, number>>(new Map());
  const waitingExtra   = useRef<Map<string, number>>(new Map()); // UUID → extra Bs
  const [tick, setTick] = useState(0);

  // ETA tracking during in_progress
  const etaTotalSecsRef = useRef<number | null>(null);
  const tripStartedAtRef = useRef<number | null>(null);
  const [etaRemaining, setEtaRemaining] = useState<number | null>(null);

  // ── Timers ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const t = setInterval(() => {
      if (arrivedAtMap.current.size > 0) setTick(n => n + 1);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      if (etaTotalSecsRef.current != null && tripStartedAtRef.current != null) {
        const elapsed = Math.floor((Date.now() - tripStartedAtRef.current) / 1000);
        setEtaRemaining(Math.max(0, etaTotalSecsRef.current - elapsed));
      }
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // ── Data ──────────────────────────────────────────────────────────────────

  const reload = useCallback(async () => {
    try {
      const data = await tripsApi.getTrip(tripUuid);
      setTrip(prev => {
        // Detect transition to in_progress to start ETA
        if (prev?.status !== 'in_progress' && data.status === 'in_progress') {
          tripStartedAtRef.current = Date.now();
        }
        // Detect cancellation by passenger
        if (data.status === 'cancelled' && prev?.status !== 'cancelled') {
          setCancelled(true);
        }
        // Detect completion
        if (data.status === 'completed' && prev?.status !== 'completed') {
          const totalExtra = [...waitingExtra.current.values()].reduce((s, v) => s + v, 0);
          const firstP = data.passengers?.[0];
          navigation.replace('TripCompletion', {
            fare:          data.fareAmount + totalExtra,
            paymentMethod: data.paymentMethod ?? 'cash',
            isPooled:      data.isPooled,
            tripUuid,
            passengerUuid: firstP?.passengerUuid,
            passengerName: firstP?.fullName,
          });
        }
        return data;
      });
      // Clean arrived map when passenger boards
      data.passengers?.forEach(p => {
        if (p.status !== 'waiting') {
          const arrivedAt = arrivedAtMap.current.get(p.passengerUuid);
          if (arrivedAt) {
            const elapsed   = Math.floor((Date.now() - arrivedAt) / 1000);
            const extraMins = Math.max(0, Math.floor((elapsed - FREE_WAIT) / 60));
            waitingExtra.current.set(p.passengerUuid, extraMins);
            arrivedAtMap.current.delete(p.passengerUuid);
          }
        }
      });
    } catch {}
  }, [tripUuid, navigation]);

  useEffect(() => { reload().finally(() => setLoading(false)); }, [reload]);
  useEffect(() => {
    const t = setInterval(reload, POLL_MS);
    return () => clearInterval(t);
  }, [reload]);

  // ── Load route from OSRM ──────────────────────────────────────────────────

  useEffect(() => {
    if (!trip) return;
    const { originLat, originLng, destinationLat, destinationLng } = trip;
    if (!originLat || !destinationLat) return;

    setMapWaypoints([
      { lat: originLat,      lng: originLng,      waypointType: 'pickup'  },
      { lat: destinationLat, lng: destinationLng, waypointType: 'dropoff' },
    ]);

    getRouteInfo(
      { latitude: originLat,      longitude: originLng      },
      { latitude: destinationLat, longitude: destinationLng },
    ).then(info => {
      setRoutePolyline(info.polyline);
      if (etaTotalSecsRef.current == null) {
        etaTotalSecsRef.current = Math.round(info.durationMinutes * 60);
      }
    }).catch(() => {});
  }, [trip?.tripUuid]);

  // ── Tigrecito route (OSM Dijkstra) ────────────────────────────────────────

  useEffect(() => {
    if (trip?.status !== 'in_progress' || tigrecitoPoly.length > 0) return;
    tripsApi.getTripRoute(tripUuid).then(r => {
      const poly = r.polyline.map(p => ({ latitude: p.lat, longitude: p.lng }));
      setTigrecitoPoly(poly);
      setTigrecitoSecs(Math.max(30, r.totalTimeSeconds));
    }).catch(() => {});
  }, [trip?.status, tripUuid, tigrecitoPoly.length]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleArrived = useCallback(async (uuid: string) => {
    arrivedAtMap.current.set(uuid, Date.now());
    setTick(n => n + 1);
    try { await driversApi.arriveTrip(tripUuid); } catch {}
  }, [tripUuid]);

  const handlePickup = useCallback(async (p: TripPassengerSummaryDto) => {
    setBusy(true);
    try {
      await driversApi.pickupPassenger(tripUuid, p.passengerUuid);
      await reload();
    } finally { setBusy(false); }
  }, [tripUuid, reload]);

  const handleStartTrip = useCallback(async () => {
    try {
      await driversApi.startTrip(tripUuid);
      tripStartedAtRef.current = Date.now();
      await reload();
    } catch {}
  }, [tripUuid, reload]);

  const handleCompleteTrip = useCallback(async () => {
    try {
      await driversApi.completeTrip(tripUuid);
      const totalExtra = [...waitingExtra.current.values()].reduce((s, v) => s + v, 0);
      const firstP = trip?.passengers?.[0];
      navigation.replace('TripCompletion', {
        fare:          (trip?.fareAmount ?? 0) + totalExtra,
        paymentMethod: trip?.paymentMethod ?? 'cash',
        isPooled:      trip?.isPooled ?? false,
        tripUuid,
        passengerUuid: firstP?.passengerUuid,
        passengerName: firstP?.fullName,
      });
    } catch {}
  }, [tripUuid, trip, navigation]);

  // ── Guards ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={S.loadingWrap}>
        <ActivityIndicator size="large" color={T.primary} />
      </View>
    );
  }
  if (!trip) return null;

  // ── Derived ───────────────────────────────────────────────────────────────

  const passengers   = [...(trip.passengers ?? [])].sort((a, b) => a.pickupOrder - b.pickupOrder);
  const allPickedUp  = passengers.length > 0 && passengers.every(p => p.status === 'picked_up' || DONE.includes(p.status));
  const allDone      = passengers.length > 0 && passengers.every(p => DONE.includes(p.status));
  const firstActive  = passengers.find(p => !DONE.includes(p.status));
  const isInProgress = trip.status === 'in_progress';
  const isDriverAssigned = trip.status === 'driver_assigned';
  const showStartSlider  = isDriverAssigned && allPickedUp && !allDone;
  const showEndSlider    = isInProgress;
  const tripTypeBadgeColor = trip.isPoolingAllowed ? T.accentDim : T.primaryDim;
  const tripTypeBadgeText  = trip.isPoolingAllowed ? T.accent    : T.primary;

  const tier = trip.serviceTier ?? 'economico';
  const TIER_LABEL: Record<string, string> = { economico: 'Económico', confort: 'Confort', premium: 'Premium' };
  const tierLabel = TIER_LABEL[tier] ?? tier;
  const TierIcon  = tier === 'premium' ? Crown : Car;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={S.safe}>
      <StatusBar style="light" />

      {/* Fullscreen map with route */}
      <AuMap
        waypoints={mapWaypoints}
        polyline={routePolyline}
        fitToCoords={routePolyline.length >= 2 ? routePolyline : undefined}
        fitPadding={MAP_PAD}
        style={StyleSheet.absoluteFill}
      >
        {isInProgress && tigrecitoPoly.length >= 2 && (
          <TigrecitoLayer polyline={tigrecitoPoly} totalTimeSeconds={tigrecitoSecs} />
        )}
      </AuMap>

      {/* Bottom sheet */}
      <View style={[S.sheet, shadow('lg')]}>
        <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>

          <View style={S.handleWrap}><View style={S.handle} /></View>

          {/* Header: title + trip type + passengers + chat */}
          <View style={S.sheetHeader}>
            <Text style={S.sheetTitle}>
              {isInProgress ? 'En camino' : 'Viaje en curso'}
            </Text>
            <View style={S.badgeRow}>
              <View style={[S.badge, S.badgeRow2, { backgroundColor: tripTypeBadgeColor }]}>
                {trip.isPoolingAllowed
                  ? <Users size={10} color={tripTypeBadgeText} />
                  : <Car   size={10} color={tripTypeBadgeText} />
                }
                <Text style={[S.badgeText, { color: tripTypeBadgeText }]}>
                  {trip.isPoolingAllowed ? 'Compartido' : 'Individual'}
                </Text>
              </View>
              <View style={[S.badge, S.badgeRow2, { backgroundColor: T.primaryDim }]}>
                <TierIcon size={10} color={T.primary} />
                <Text style={[S.badgeText, { color: T.primary }]}>{tierLabel}</Text>
              </View>
              <View style={[S.badge, { backgroundColor: T.surf }]}>
                <Text style={[S.badgeText, { color: T.lo }]}>
                  {passengers.length} pas.
                </Text>
              </View>
            </View>
          </View>

          {/* ETA strip during in_progress */}
          {isInProgress && (
            <View style={S.etaStrip}>
              <View style={S.etaLeft}>
                <Flag size={14} color={T.accent} />
                <Text style={S.etaText}>
                  {etaRemaining != null ? `ETA ${fmtEta(etaRemaining)}` : 'En camino'}
                </Text>
              </View>
              <View style={S.payMethodPill}>
                {trip.paymentMethod === 'qr'
                  ? <QrCode    size={13} color={T.mid} />
                  : <Banknote  size={13} color={T.mid} />
                }
                <Text style={S.payMethodText}>
                  {trip.paymentMethod === 'qr' ? 'QR' : 'Efectivo'}
                </Text>
              </View>
            </View>
          )}

          <View style={S.hairline} />

          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={S.listContent}
          >
            {/* ── Cancelled state ── */}
            {cancelled && (
              <View style={S.cancelledCard}>
                <XCircle size={36} color={T.error} />
                <Text style={S.cancelledTitle}>Viaje cancelado</Text>
                <Text style={S.cancelledSub}>El pasajero canceló el viaje. No se sumará a tu historial.</Text>
                <TouchableOpacity
                  style={S.cancelledBackBtn}
                  onPress={() => navigation.goBack()}
                  activeOpacity={0.8}
                >
                  <Text style={S.cancelledBackText}>Volver al inicio</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Passenger cards */}
            {!cancelled && !isInProgress && passengers.map((p, i) => {
              const isDone     = DONE.includes(p.status);
              const isNext     = !isDone && p === firstActive;
              const arrivedAt  = arrivedAtMap.current.get(p.passengerUuid);
              const hasArrived = arrivedAt != null && p.status === 'waiting';

              if (hasArrived && arrivedAt != null) {
                return (
                  <PassengerWaitCard
                    key={p.passengerUuid}
                    passenger={p}
                    arrivedAt={arrivedAt}
                    onPickup={() => handlePickup(p)}
                    busy={busy}
                    tick={tick}
                  />
                );
              }

              return (
                <View
                  key={p.passengerUuid}
                  style={[S.stopCard, isNext && S.stopCardNext, shadow('sm')]}
                >
                  <View style={S.stopHeader}>
                    <View style={[
                      S.orderBadge,
                      isNext && S.orderBadgeNext,
                      isDone && S.orderBadgeDone,
                    ]}>
                      <Text style={S.orderText}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={S.passengerName}>{p.fullName}</Text>
                      <Text style={[S.passengerStatus, { color: STATUS_COLOR[p.status] ?? T.lo }]}>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </Text>
                    </View>
                    {isDone && <CheckCircle size={16} color={T.accent} />}
                  </View>

                  {!isDone && (
                    <View style={S.miniRoute}>
                      <View style={S.miniTrack}>
                        <View style={[S.miniDot, { backgroundColor: T.accent }]} />
                        <View style={S.miniLine} />
                        <View style={[S.miniDot, { backgroundColor: T.primary }]} />
                      </View>
                      <View style={S.miniAddresses}>
                        <Text style={S.miniAddr} numberOfLines={1}>{p.pickupAddress}</Text>
                        <Text style={S.miniAddr} numberOfLines={1}>{p.dropoffAddress}</Text>
                      </View>
                    </View>
                  )}

                  {p.status === 'waiting' && (
                    <TouchableOpacity
                      style={[S.actionBtn, S.actionBtnSecondary, busy && S.btnDisabled]}
                      onPress={() => handleArrived(p.passengerUuid)}
                      disabled={busy}
                    >
                      <Text style={[S.actionBtnText, { color: T.mid }]}>Ya llegué al punto</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            {/* During in_progress: fare + payment + route card */}
            {!cancelled && isInProgress && (
              <View style={[S.inProgressCard, shadow('md')]}>
                {/* Fare row */}
                <View style={S.inProgressFareRow}>
                  <View>
                    <Text style={S.inProgressFareLabel}>Total a cobrar</Text>
                    <Text style={S.inProgressFareAmt}>
                      Bs. {Math.round(trip.fareAmount)}
                    </Text>
                  </View>
                  <View style={[
                    S.payBadge,
                    trip.paymentMethod === 'qr' && S.payBadgeQR,
                  ]}>
                    {trip.paymentMethod === 'qr'
                      ? <QrCode   size={18} color={T.primary} />
                      : <Banknote size={18} color={T.accent}  />
                    }
                    <Text style={[
                      S.payBadgeText,
                      { color: trip.paymentMethod === 'qr' ? T.primary : T.accent },
                    ]}>
                      {trip.paymentMethod === 'qr' ? 'Cobro por QR' : 'Cobro en efectivo'}
                    </Text>
                  </View>
                </View>

                <View style={S.hairline} />

                {/* Route */}
                <View style={S.miniRoute}>
                  <View style={S.miniTrack}>
                    <View style={[S.miniDot, { backgroundColor: T.accent }]} />
                    <View style={S.miniLine} />
                    <View style={[S.miniDot, { backgroundColor: T.error }]} />
                  </View>
                  <View style={S.miniAddresses}>
                    <Text style={S.miniAddr} numberOfLines={2}>
                      {trip.passengers?.[0]?.pickupAddress ?? '—'}
                    </Text>
                    <Text style={S.miniAddr} numberOfLines={2}>
                      {trip.passengers?.[0]?.dropoffAddress ?? '—'}
                    </Text>
                  </View>
                </View>
              </View>
            )}
            {/* Slide to start trip */}
            {!cancelled && showStartSlider && (
              <View style={S.swipeWrap}>
                <Text style={S.swipeHint}>Todos a bordo — iniciá la carrera</Text>
                <SwipeButton
                  label="Deslizá para iniciar viaje"
                  direction="right"
                  color="#00C9A7"
                  onSwipeComplete={handleStartTrip}
                />
              </View>
            )}

            {/* Slide to end trip */}
            {!cancelled && showEndSlider && (
              <View style={S.swipeWrap}>
                <Text style={S.swipeHint}>Deslizá cuando lleguen al destino</Text>
                <SwipeButton
                  label="Deslizá para finalizar viaje"
                  direction="left"
                  color="#FF6B6B"
                  onSwipeComplete={handleCompleteTrip}
                />
              </View>
            )}
          </ScrollView>

        </SafeAreaView>
      </View>

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: T.bg },
  loadingWrap: { flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' },

  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: SHEET_H,
    backgroundColor: T.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: T.border,
  },
  handleWrap: { alignItems: 'center', paddingTop: T.sm, paddingBottom: T.xs },
  handle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: T.border },

  sheetHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: T.md, paddingBottom: T.xs,
  },
  sheetTitle: { ...Typography.h3 },
  badgeRow:   { flexDirection: 'row', gap: T.xs },
  badge:          { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeRow2:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badgeText:      { fontSize: 11, fontWeight: '600' },
  etaStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: T.md, paddingBottom: T.xs,
  },
  etaLeft:  { flexDirection: 'row', alignItems: 'center', gap: T.xs },
  etaText:  { fontSize: 13, fontWeight: '600', color: T.accent },
  payMethodPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: T.surf, borderRadius: 20,
    borderWidth: 1, borderColor: T.border,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  payMethodText: { fontSize: 12, fontWeight: '600', color: T.mid },

  hairline:    { height: 1, backgroundColor: T.border },
  listContent: { padding: T.md, gap: T.sm, paddingBottom: T.sm },

  stopCard:        { backgroundColor: T.surf, borderRadius: 16, borderWidth: 1, borderColor: T.border, padding: T.md, gap: T.sm },
  stopCardNext:    { borderColor: T.primary, borderWidth: 1.5 },
  stopCardArrived: { borderColor: T.warning, borderWidth: 1.5 },

  stopHeader:        { flexDirection: 'row', alignItems: 'center', gap: T.sm },
  orderBadge:        { width: 28, height: 28, borderRadius: 14, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  orderBadgeNext:    { backgroundColor: T.primary, borderColor: T.primary },
  orderBadgeDone:    { backgroundColor: T.accentDim, borderColor: T.accent },
  orderBadgeArrived: { backgroundColor: T.warning, borderColor: T.warning },
  orderText:         { fontSize: 12, fontWeight: '700', color: T.hi },
  passengerName:     { fontSize: 15, fontWeight: '600', color: T.hi, marginBottom: 2 },
  passengerStatus:   { fontSize: 12, fontWeight: '500' },

  miniRoute:     { flexDirection: 'row', alignItems: 'stretch', gap: T.sm, paddingTop: T.xs },
  miniTrack:     { alignItems: 'center', paddingVertical: 2 },
  miniDot:       { width: 8, height: 8, borderRadius: 4 },
  miniLine:      { width: 1.5, flex: 1, minHeight: 12, backgroundColor: T.border, marginVertical: 2 },
  miniAddresses: { flex: 1, justifyContent: 'space-between', gap: 8 },
  miniAddr:      { fontSize: 13, color: T.mid, lineHeight: 18 },

  fareRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: T.xs },
  fareLabel: { fontSize: 13, color: T.lo },
  fareAmt:   { fontSize: 20, fontWeight: '700', color: T.accent },

  inProgressCard: {
    backgroundColor: T.surf, borderRadius: 20,
    borderWidth: 1.5, borderColor: T.border,
    padding: T.md, gap: T.sm,
  },
  inProgressFareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inProgressFareLabel: { fontSize: 12, color: T.lo, fontWeight: '500', marginBottom: 2 },
  inProgressFareAmt:   { fontSize: 32, fontWeight: '900', color: T.accent, fontVariant: ['tabular-nums'] },
  payBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: T.accentDim, borderRadius: 12,
    borderWidth: 1, borderColor: T.accent + '60',
    paddingHorizontal: T.sm, paddingVertical: 8,
  },
  payBadgeQR: { backgroundColor: T.primaryDim, borderColor: T.primary + '60' },
  payBadgeText: { fontSize: 13, fontWeight: '700' },

  actionBtn:          { borderRadius: 10, paddingVertical: 13, alignItems: 'center', borderWidth: 1 },
  actionBtnSecondary: { backgroundColor: T.surf, borderColor: T.border },
  actionBtnPrimary:   { backgroundColor: T.primary, borderColor: T.primary },
  actionBtnText:      { fontSize: 14, fontWeight: '600' },
  btnDisabled:        { opacity: 0.5 },

  swipeWrap:   { gap: T.xs, paddingTop: T.xs },
  swipeHint:   { fontSize: 11, color: T.lo, textAlign: 'center', fontWeight: '500' },

  cancelledCard: {
    backgroundColor: T.errorDim,
    borderRadius:    20,
    borderWidth:     1,
    borderColor:     T.error,
    padding:         T.lg,
    alignItems:      'center',
    gap:             T.sm,
  },
  cancelledTitle:   { fontSize: 20, fontWeight: '800', color: T.error },
  cancelledSub:     { fontSize: 13, color: T.mid, textAlign: 'center', lineHeight: 18 },
  cancelledBackBtn: {
    marginTop:         T.sm,
    backgroundColor:   T.surf,
    borderRadius:      12,
    borderWidth:       1,
    borderColor:       T.border,
    paddingVertical:   12,
    paddingHorizontal: T.lg,
  },
  cancelledBackText: { fontSize: 14, fontWeight: '600', color: T.hi },
});
