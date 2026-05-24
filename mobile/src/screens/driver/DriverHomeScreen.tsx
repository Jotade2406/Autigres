import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity,
  ActivityIndicator, Alert, Dimensions, StyleProp, ViewStyle,
  PanResponder,
} from 'react-native';
import { StatusBar }             from 'expo-status-bar';
import { useSafeAreaInsets }     from 'react-native-safe-area-context';
import { SafeAreaView }          from 'react-native-safe-area-context';
import { useNavigation }         from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { LatLng }           from 'react-native-maps';
import { Car, Users, MapPin, X, Check } from 'lucide-react-native';
import { AuMap }           from '../../components/map/AuMap';
import { driversApi }      from '../../api/drivers.api';
import { getRouteInfo }    from '../../services/directions';
import { useAuthStore }    from '../../store/auth.store';
import { useDriverStore }  from '../../store/driver.store';
import { useDriverLocation } from '../../hooks/useDriverLocation';
import { Colors }          from '../../theme/colors';
import { Typography }      from '../../theme/typography';
import { Spacing }         from '../../theme/spacing';
import type { TripResponseDto, WaypointDto } from '../../api/types';
import type { DriverStackParamList } from '../../navigation/DriverNavigator';

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
  xs: Spacing.xs,
  sm: Spacing.sm,
  md: Spacing.md,
  lg: Spacing.lg,
  xl: Spacing.xl,
} as const;

// ── Shadow helper ─────────────────────────────────────────────────────────────

function shadow(size: 'sm' | 'md' | 'lg' = 'md') {
  const cfg = { sm: { e: 4, r: 4, o: 0.20 }, md: { e: 8, r: 8, o: 0.25 }, lg: { e: 16, r: 12, o: 0.35 } }[size];
  return { shadowColor: '#000' as const, shadowOffset: { width: 0, height: cfg.e / 2 }, shadowOpacity: cfg.o, shadowRadius: cfg.r, elevation: cfg.e };
}

// ── Haversine distance ────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const r = (d: number) => d * Math.PI / 180;
  const dLat = r(lat2 - lat1);
  const dLng = r(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

interface BtnProps { label: string; onPress: () => void; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }
interface GhostBtnProps extends Omit<BtnProps, 'disabled'> { color?: string }

function PrimaryButton({ label, onPress, loading = false, disabled = false, style }: BtnProps) {
  const off = loading || disabled;
  return (
    <TouchableOpacity style={[S.btnBase, S.btnPrimary, off && S.btnDisabled, style]} onPress={onPress} disabled={off} activeOpacity={0.75}>
      {loading ? <ActivityIndicator color={T.hi} size="small" /> : <Text style={S.btnPrimaryText}>{label}</Text>}
    </TouchableOpacity>
  );
}

function GhostButton({ label, onPress, color = T.mid, loading = false, style }: GhostBtnProps) {
  return (
    <TouchableOpacity style={[S.btnBase, S.btnGhost, style]} onPress={onPress} disabled={loading} activeOpacity={0.7}>
      {loading ? <ActivityIndicator color={color} size="small" /> : <Text style={[S.btnGhostText, { color }]}>{label}</Text>}
    </TouchableOpacity>
  );
}

function AddressRow({ origin, destination }: { origin: string; destination: string }) {
  return (
    <View style={CS.routeRow}>
      <View style={CS.routeTrack}>
        <View style={[CS.dot, { backgroundColor: T.accent }]} />
        <View style={CS.routeLine} />
        <View style={[CS.dot, { backgroundColor: T.error }]} />
      </View>
      <View style={CS.routeAddresses}>
        <Text style={CS.addr} numberOfLines={2}>{origin}</Text>
        <Text style={CS.addr} numberOfLines={2}>{destination}</Text>
      </View>
    </View>
  );
}

// ── Animated online toggle ────────────────────────────────────────────────────

interface ToggleProps { isOnline: boolean; onToggle: (v: boolean) => void; disabled?: boolean }

function OnlineToggle({ isOnline, onToggle, disabled }: ToggleProps) {
  const anim = useRef(new Animated.Value(isOnline ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: isOnline ? 1 : 0,
      useNativeDriver: false,
      tension: 120, friction: 8,
    }).start();
  }, [isOnline, anim]);

  const trackBg = anim.interpolate({ inputRange: [0, 1], outputRange: [Colors.border, Colors.accent] });
  const thumbX  = anim.interpolate({ inputRange: [0, 1], outputRange: [3, 29] });

  return (
    <TouchableOpacity onPress={() => !disabled && onToggle(!isOnline)} activeOpacity={0.85} disabled={disabled}>
      <Animated.View style={[S.toggleTrack, { backgroundColor: trackBg }]}>
        <Animated.View style={[S.toggleThumb, { transform: [{ translateX: thumbX }] }]} />
      </Animated.View>
    </TouchableOpacity>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const POLL_MS        = 5_000;
const CARD_TIMER_MS  = 10_000;
const SNOOZE_MS      = 30_000;
const { width: SCREEN_W } = Dimensions.get('window');
const MAP_FIT_PADDING = { top: 100, right: 50, bottom: 240, left: 50 };

// ── Trip Notification Card ────────────────────────────────────────────────────

interface CardProps {
  trip: TripResponseDto;
  totalVisible: number;
  position: number;
  accepting: boolean;
  distanceKm: number | null;
  onAccept: () => void;
  onSnooze: () => void;
  onExpire: () => void;
}

function TripNotificationCard({
  trip, totalVisible, position, accepting, distanceKm,
  onAccept, onSnooze, onExpire,
}: CardProps) {
  const translateX  = useRef(new Animated.Value(0)).current;
  const enterY      = useRef(new Animated.Value(-180)).current;
  const opacity     = useRef(new Animated.Value(0)).current;
  const timerWidth  = useRef(new Animated.Value(1)).current;
  const [secsLeft, setSecsLeft] = useState(Math.round(CARD_TIMER_MS / 1000));

  const firstPickup  = trip.passengers?.[0]?.pickupAddress  ?? trip.originAddress  ?? '—';
  const lastDropoff  = trip.passengers?.[trip.passengers.length - 1]?.dropoffAddress ?? trip.destinationAddress ?? '—';

  const snoozeRef  = useRef(onSnooze);
  const expireRef  = useRef(onExpire);
  snoozeRef.current = onSnooze;
  expireRef.current = onExpire;

  // Enter animation + timer
  useEffect(() => {
    Animated.parallel([
      Animated.spring(enterY,  { toValue: 0,   useNativeDriver: true, tension: 70, friction: 11 }),
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();

    Animated.timing(timerWidth, {
      toValue: 0,
      duration: CARD_TIMER_MS,
      useNativeDriver: false,
    }).start(({ finished }) => { if (finished) expireRef.current(); });

    const tick = setInterval(() => setSecsLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(tick);
  }, []);

  // Swipe right gesture
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, { dx, dy }) =>
      Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5,
    onPanResponderMove: (_, { dx }) => {
      translateX.setValue(dx > 0 ? dx : dx * 0.15);
    },
    onPanResponderRelease: (_, { dx, vx }) => {
      if (dx > 80 || (dx > 40 && vx > 0.5)) {
        Animated.timing(translateX, {
          toValue: SCREEN_W + 100,
          duration: 220,
          useNativeDriver: true,
        }).start(() => snoozeRef.current());
      } else {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 150, friction: 10 }).start();
      }
    },
  }), []);

  const timerColor = timerWidth.interpolate({
    inputRange: [0, 0.3, 0.6, 1],
    outputRange: ['#FF4444', '#FF9500', '#FFD700', '#34C759'],
  });

  const isPooled = trip.isPoolingAllowed && trip.totalPassengers > 1;

  return (
    <Animated.View
      style={[CS.card, { transform: [{ translateX }, { translateY: enterY }], opacity }]}
      {...panResponder.panHandlers}
    >
      {/* Timer bar */}
      <Animated.View style={[CS.timerBar, {
        width: timerWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        backgroundColor: timerColor,
      }]} />

      {/* Header row */}
      <View style={CS.cardHeader}>
        <View style={CS.headerLeft}>
          <Text style={CS.newTripLabel}>Nuevo viaje</Text>
          <View style={CS.badges}>
            <View style={[CS.badge, isPooled && CS.badgePooled]}>
              <View style={CS.badgeInner}>
                {isPooled
                  ? <Users size={10} color={T.primary} />
                  : <Car   size={10} color={T.accent}  />
                }
                <Text style={[CS.badgeText, isPooled && CS.badgeTextPooled]}>
                  {isPooled ? 'Compartido' : 'Individual'}
                </Text>
              </View>
            </View>
            {totalVisible > 1 && (
              <View style={CS.badgeCount}>
                <Text style={CS.badgeCountText}>{position}/{totalVisible}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={CS.timerPill}>
          <Text style={[CS.timerText, secsLeft <= 3 && { color: '#FF4444' }]}>{secsLeft}s</Text>
        </View>
      </View>

      {/* Route */}
      <View style={CS.routeRow}>
        <View style={CS.routeTrack}>
          <View style={[CS.dot, { backgroundColor: T.accent }]} />
          <View style={CS.routeLine} />
          <View style={[CS.dot, { backgroundColor: T.error }]} />
        </View>
        <View style={CS.routeAddresses}>
          <Text style={CS.addr} numberOfLines={1}>{firstPickup}</Text>
          <Text style={CS.addr} numberOfLines={1}>{lastDropoff}</Text>
        </View>
      </View>

      {/* Fare + distance row */}
      <View style={CS.metaRow}>
        <Text style={CS.fare}>Bs. {Math.round(trip.fareAmount)}</Text>
        {distanceKm != null && (
          <View style={CS.distRow}>
            <MapPin size={12} color={T.lo} />
            <Text style={CS.dist}>
              {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`}
            </Text>
          </View>
        )}
        <Text style={CS.hint}>← deslizá para ignorar</Text>
      </View>

      {/* Action buttons */}
      <View style={CS.btnRow}>
        <TouchableOpacity style={CS.ignoreBtn} onPress={onSnooze} activeOpacity={0.75}>
          <View style={CS.btnInner}>
            <X size={14} color={T.lo} />
            <Text style={CS.ignoreBtnText}>Ignorar</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[CS.acceptBtn, accepting && CS.btnDisabled]}
          onPress={onAccept}
          disabled={accepting}
          activeOpacity={0.85}
        >
          {accepting
            ? <ActivityIndicator color="#fff" size="small" />
            : <View style={CS.btnInner}>
                <Check size={15} color="#fff" />
                <Text style={CS.acceptBtnText}>Aceptar</Text>
              </View>
          }
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function DriverHomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<DriverStackParamList>>();
  const insets     = useSafeAreaInsets();
  const { user }   = useAuthStore();
  const { isOnline, setOnline, currentLat, currentLng } = useDriverStore();

  const [pendingTrips, setPendingTrips]   = useState<TripResponseDto[]>([]);
  const [snoozedUntil, setSnoozedUntil]  = useState<Map<string, number>>(new Map());
  const [cardIdx, setCardIdx]            = useState(0);
  const [toggling, setToggling]          = useState(false);
  const [accepting, setAccepting]        = useState(false);
  const [tripPolyline, setTripPolyline]   = useState<LatLng[]>([]);
  const [tripWaypoints, setTripWaypoints] = useState<WaypointDto[]>([]);

  useDriverLocation();

  // ── Animations ───────────────────────────────────────────────────────────

  // Green pulse on the "En línea" dot
  const onlinePulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isOnline) { onlinePulse.setValue(0); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(onlinePulse, { toValue: 1,   duration: 900, useNativeDriver: true }),
        Animated.timing(onlinePulse, { toValue: 0.2, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isOnline, onlinePulse]);

  // Opacity pulse on waiting chip
  const waitingPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(waitingPulse, { toValue: 0.45, duration: 1100, useNativeDriver: true }),
        Animated.timing(waitingPulse, { toValue: 1,    duration: 1100, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [waitingPulse]);


  // ── Data ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOnline) { setPendingTrips([]); return; }
    const poll = async () => {
      try {
        const trips = await driversApi.getPendingTrips();
        setPendingTrips(trips);
      } catch {}
    };
    poll();
    const t = setInterval(poll, POLL_MS);
    return () => clearInterval(t);
  }, [isOnline]);

  // Visible trips = pending minus snoozed
  const visibleTrips = useMemo(() => {
    const now = Date.now();
    return pendingTrips.filter(t => (snoozedUntil.get(t.tripUuid) ?? 0) <= now);
  }, [pendingTrips, snoozedUntil]);

  const currentTrip = visibleTrips.length > 0
    ? visibleTrips[cardIdx % visibleTrips.length]
    : null;

  // Load route for the currently displayed card
  useEffect(() => {
    if (!currentTrip) {
      setTripPolyline([]);
      setTripWaypoints([]);
      return;
    }
    const { originLat, originLng, destinationLat, destinationLng } = currentTrip;
    setTripWaypoints([
      { lat: originLat,      lng: originLng,      waypointType: 'pickup'  },
      { lat: destinationLat, lng: destinationLng, waypointType: 'dropoff' },
    ]);
    getRouteInfo(
      { latitude: originLat,      longitude: originLng      },
      { latitude: destinationLat, longitude: destinationLng },
    ).then(info => setTripPolyline(info.polyline)).catch(() => {});
  }, [currentTrip?.tripUuid]);

  const toggleOnline = useCallback(async (value: boolean) => {
    setToggling(true);
    setOnline(value);
    try { await driversApi.setOnline(value); } catch {}
    finally { setToggling(false); }
  }, [setOnline]);

  const handleSnooze = useCallback((tripUuid: string) => {
    setSnoozedUntil(prev => {
      const next = new Map(prev);
      next.set(tripUuid, Date.now() + SNOOZE_MS);
      return next;
    });
    setCardIdx(i => i + 1);
  }, []);

  const handleExpire = useCallback(() => {
    // Rotate to next without snoozing — trip stays visible
    setCardIdx(i => i + 1);
  }, []);

  const handleAcceptTrip = useCallback(async (tripUuid: string) => {
    setAccepting(true);
    try {
      await driversApi.acceptTrip(tripUuid);
      useDriverStore.getState().setCurrentTripUuid(tripUuid);
      navigation.navigate('ActiveTripDriver', { tripUuid });
    } catch (err: any) {
      setPendingTrips(prev => prev.filter(t => t.tripUuid !== tripUuid));
      const msg: string =
        err?.response?.data?.message ??
        err?.response?.data?.error   ??
        err?.message ?? '';
      if (msg.toLowerCase().includes('vehículo') || msg.toLowerCase().includes('vehiculo')) {
        Alert.alert('Sin vehículo registrado', 'Registrá un vehículo para poder aceptar viajes.', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Registrar vehículo', onPress: () => navigation.navigate('RegisterVehicle') },
        ]);
      } else {
        Alert.alert('Error', msg || 'No se pudo aceptar el viaje. Intentá de nuevo.');
      }
    } finally {
      setAccepting(false);
    }
  }, [navigation]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const userLocation = currentLat != null && currentLng != null
    ? { latitude: currentLat, longitude: currentLng } : undefined;

  const initials = user?.fullName
    ? user.fullName.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : '?';

  const currentDistanceKm = useMemo(() => {
    if (!currentLat || !currentLng || !currentTrip) return null;
    const wp = currentTrip.route.find((w: WaypointDto) => w.waypointType === 'pickup');
    if (!wp) return null;
    return haversineKm(currentLat, currentLng, wp.lat, wp.lng);
  }, [currentLat, currentLng, currentTrip]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={S.safe}>
      <StatusBar style="light" />

      {/* Fullscreen map — shows route when a trip is pending */}
      <AuMap
        userLocation={userLocation}
        waypoints={tripWaypoints}
        polyline={tripPolyline}
        fitToCoords={tripPolyline.length >= 2 ? tripPolyline : undefined}
        fitPadding={MAP_FIT_PADDING}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Floating header pill ── */}
      <View style={[S.header, { top: insets.top + T.sm }, shadow('md')]}>
        {/* Avatar */}
        <View style={S.avatar}>
          <Text style={S.avatarText}>{initials}</Text>
        </View>

        {/* Status */}
        <View style={S.headerStatus}>
          <View style={S.onlineRow}>
            {isOnline && (
              <Animated.View style={[S.onlineDot, { opacity: onlinePulse }]} />
            )}
            <Text style={S.onlineLabel}>{isOnline ? 'En línea' : 'Desconectado'}</Text>
          </View>
          <Text style={S.onlineSub}>
            {isOnline ? 'Recibiendo solicitudes' : 'No visible para pasajeros'}
          </Text>
        </View>

        {/* Toggle */}
        {toggling
          ? <ActivityIndicator size="small" color={T.primary} />
          : <OnlineToggle isOnline={isOnline} onToggle={toggleOnline} />
        }
      </View>

      {/* ── Waiting chip (online, no visible trips) ── */}
      {isOnline && visibleTrips.length === 0 && (
        <Animated.View style={[S.waitingChip, { opacity: waitingPulse, bottom: insets.bottom + T.xl }, shadow('sm')]}>
          <View style={S.waitingDot} />
          <Text style={S.waitingText}>Esperando solicitudes...</Text>
        </Animated.View>
      )}

      {/* ── Floating trip notification card ── */}
      {isOnline && currentTrip && (
        <View style={[S.cardContainer, { top: insets.top + 72 }]}>
          <TripNotificationCard
            key={currentTrip.tripUuid + '-' + cardIdx}
            trip={currentTrip}
            totalVisible={visibleTrips.length}
            position={(cardIdx % visibleTrips.length) + 1}
            accepting={accepting}
            distanceKm={currentDistanceKm}
            onAccept={() => handleAcceptTrip(currentTrip.tripUuid)}
            onSnooze={() => handleSnooze(currentTrip.tripUuid)}
            onExpire={handleExpire}
          />
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },

  // Floating header
  header: {
    position:       'absolute',
    left:           T.md,
    right:          T.md,
    backgroundColor:T.card,
    borderRadius:   20,
    borderWidth:    1,
    borderColor:    T.border,
    padding:        12,
    flexDirection:  'row',
    alignItems:     'center',
    gap:            T.sm,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: T.primaryDim,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText:   { fontSize: 15, fontWeight: '700', color: T.primary },
  headerStatus: { flex: 1, gap: 2 },
  onlineRow:    { flexDirection: 'row', alignItems: 'center', gap: T.xs },
  onlineDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: T.accent,
  },
  onlineLabel: { fontSize: 14, fontWeight: '600', color: T.hi },
  onlineSub:   { fontSize: 11, color: T.lo },

  // Toggle
  toggleTrack: {
    width: 56, height: 28, borderRadius: 14, justifyContent: 'center',
  },
  toggleThumb: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: T.hi,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 }, elevation: 3,
  },

  // Waiting chip
  waitingChip: {
    position:       'absolute',
    left:           T.xl,
    right:          T.xl,
    backgroundColor:T.surf,
    borderRadius:   24,
    borderWidth:    1,
    borderColor:    T.border,
    paddingHorizontal: T.lg,
    paddingVertical:   12,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            T.sm,
  },
  waitingDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: T.lo,
  },
  waitingText: { fontSize: 14, color: T.mid, fontWeight: '500' },

  // Card container
  cardContainer: {
    position: 'absolute',
    left: T.md,
    right: T.md,
  },

  // Buttons (kept for PrimaryButton / GhostButton used elsewhere)
  btnBase:        { borderRadius: 12, paddingVertical: 14, paddingHorizontal: T.md, alignItems: 'center', justifyContent: 'center' },
  btnPrimary:     { backgroundColor: T.primary },
  btnDisabled:    { opacity: 0.5 },
  btnPrimaryText: { fontSize: 15, fontWeight: '600', color: T.hi },
  btnGhost:       { backgroundColor: 'transparent' },
  btnGhostText:   { fontSize: 15, fontWeight: '600' },
});

// ── TripNotificationCard styles ───────────────────────────────────────────────

const CS = StyleSheet.create({
  card: {
    backgroundColor: T.card,
    borderRadius:    20,
    borderWidth:     1,
    borderColor:     T.border,
    overflow:        'hidden',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 8 },
    shadowOpacity:   0.35,
    shadowRadius:    12,
    elevation:       16,
  },
  timerBar: {
    height:          4,
    alignSelf:       'flex-start',
  },
  cardHeader: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    paddingHorizontal: T.md,
    paddingTop:       T.sm,
    paddingBottom:    T.xs,
  },
  headerLeft:  { gap: 4 },
  newTripLabel:{ fontSize: 17, fontWeight: '800', color: T.hi },
  badges:      { flexDirection: 'row', gap: T.xs, flexWrap: 'wrap' },
  badge: {
    backgroundColor:  T.accentDim,
    borderRadius:     20,
    paddingHorizontal:8,
    paddingVertical:  3,
  },
  badgePooled:     { backgroundColor: T.primaryDim },
  badgeText:       { fontSize: 11, fontWeight: '600', color: T.accent },
  badgeTextPooled: { color: T.primary },
  badgeInner: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  badgeCount: {
    backgroundColor: T.surf,
    borderRadius:    20,
    borderWidth:     1,
    borderColor:     T.border,
    paddingHorizontal: 7,
    paddingVertical:   3,
  },
  badgeCountText: { fontSize: 11, fontWeight: '600', color: T.lo },
  timerPill: {
    backgroundColor: T.surf,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     T.border,
    paddingHorizontal: 10,
    paddingVertical:   5,
    minWidth:        40,
    alignItems:      'center',
  },
  timerText: { fontSize: 15, fontWeight: '800', color: T.hi, fontVariant: ['tabular-nums'] as any },

  routeRow:       { flexDirection: 'row', alignItems: 'stretch', gap: 10, paddingHorizontal: T.md, marginBottom: T.sm },
  routeTrack:     { alignItems: 'center', paddingVertical: 2 },
  dot:            { width: 9, height: 9, borderRadius: 5 },
  routeLine:      { width: 2, flex: 1, minHeight: 14, backgroundColor: T.border, marginVertical: 2 },
  routeAddresses: { flex: 1, justifyContent: 'space-between', gap: 8 },
  addr:           { fontSize: 13, color: T.mid, lineHeight: 18 },

  metaRow: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              T.sm,
    paddingHorizontal:T.md,
    paddingBottom:    T.sm,
    flexWrap:         'wrap',
  },
  fare:    { fontSize: 22, fontWeight: '800', color: T.accent },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 3, flex: 1 },
  dist:    { fontSize: 12, color: T.lo },
  hint:    { fontSize: 10, color: T.lo, marginLeft: 'auto' as any },

  btnRow: {
    flexDirection:    'row',
    gap:              T.sm,
    paddingHorizontal:T.md,
    paddingBottom:    T.md,
  },
  ignoreBtn: {
    flex:            1,
    borderRadius:    12,
    paddingVertical: 13,
    alignItems:      'center',
    backgroundColor: T.surf,
    borderWidth:     1,
    borderColor:     T.border,
  },
  btnInner:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ignoreBtnText: { fontSize: 14, fontWeight: '600', color: T.lo },
  acceptBtn: {
    flex:            2,
    borderRadius:    12,
    paddingVertical: 13,
    alignItems:      'center',
    backgroundColor: T.primary,
  },
  acceptBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  btnDisabled:   { opacity: 0.5 },
});
