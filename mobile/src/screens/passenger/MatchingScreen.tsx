import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated,
  TouchableOpacity, ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { Users, Car, X, MapPin, List } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuMap }          from '../../components/map/AuMap';
import { useTripPolling } from '../../hooks/useTripPolling';
import { tripsApi }       from '../../api/trips.api';
import { Colors }         from '../../theme/colors';
import { Spacing }        from '../../theme/spacing';
import type { WaypointDto, NearbyPassengerDto, IncomingShareRequestDto } from '../../api/types';
import type { PassengerStackParamList } from '../../navigation/PassengerNavigator';

type Props = NativeStackScreenProps<PassengerStackParamList, 'Matching'>;

const T = {
  bg:         Colors.bgPrimary,
  surf:       Colors.surface,
  card:       Colors.card,
  border:     Colors.border,
  primary:    Colors.primary,
  primaryDim: Colors.primaryDim,
  accent:     Colors.accent,
  error:      Colors.error,
  hi:         Colors.textHigh,
  mid:        Colors.textMid,
  lo:         Colors.textLow,
  xs: Spacing.xs, sm: Spacing.sm, md: Spacing.md, lg: Spacing.lg,
} as const;

function shadow(size: 'sm' | 'md' | 'lg' = 'md') {
  const cfg = { sm: { e: 4, r: 4, o: 0.20 }, md: { e: 8, r: 8, o: 0.25 }, lg: { e: 16, r: 12, o: 0.35 } }[size];
  return { shadowColor: '#000' as const, shadowOffset: { width: 0, height: cfg.e / 2 }, shadowOpacity: cfg.o, shadowRadius: cfg.r, elevation: cfg.e };
}

const { height: SCREEN_H } = Dimensions.get('window');
const CONFIRM_H = 240;
const MAP_PAD   = { top: 80, right: 48, bottom: 260, left: 48 };
const RING_SIZE     = 72;
const RING_SCALE    = 3.6;
const RING_DURATION = 2000;
const RING_STAGGER  = 667;

// 'incoming' is now a separate top-banner state, NOT part of ShareState
type ShareState =
  | 'searching'
  | 'has-suggestion'
  | 'waiting'
  | 'rejected'
  | 'acting';

export function MatchingScreen({ route, navigation }: Props) {
  const {
    requestUuid, routePolyline = [],
    originAddress = '', destAddress = '', estimatedFare,
  } = route.params;

  const [cancelling,   setCancelling]   = useState(false);
  const [dots,         setDots]         = useState('');
  const [showDetails,  setShowDetails]  = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);

  // Solo trip UUID — set when request becomes 'matched', before driver assigned
  const [soloTripUuid, setSoloTripUuid] = useState<string | null>(null);

  // Guard against double-navigation
  const navigatedRef = useRef(false);
  // Ref-based navigation function — avoids adding it to polling effect deps
  const goToActiveTripRef = useRef((_tripUuid: string) => {});
  useEffect(() => {
    goToActiveTripRef.current = (tripUuid: string) => {
      if (navigatedRef.current) return;
      navigatedRef.current = true;
      navigation.replace('ActiveTrip', { tripUuid, routePolyline });
    };
  }, [navigation, routePolyline]);

  // ── Share state (bottom card) ─────────────────────────────────────────────
  const [shareState,  setShareState]  = useState<ShareState>('searching');
  const [suggestion,  setSuggestion]  = useState<NearbyPassengerDto | null>(null);
  const [shareUuid,   setShareUuid]   = useState<string | null>(null);

  // ── Incoming request (TOP banner) — decoupled from shareState ─────────────
  const [incoming,       setIncoming]       = useState<IncomingShareRequestDto | null>(null);
  const [incomingActing, setIncomingActing] = useState(false);
  // Ref so polling effect doesn't need 'incoming' in its dependency array
  const incomingRef = useRef<IncomingShareRequestDto | null>(null);

  const ignoredSuggestions = useRef<Set<string>>(new Set());

  // ── Radar rings ──────────────────────────────────────────────────────────
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: RING_DURATION, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0, duration: 0,             useNativeDriver: true }),
        ])
      ).start();
    pulse(ring1, 0);
    pulse(ring2, RING_STAGGER);
    pulse(ring3, RING_STAGGER * 2);
  }, [ring1, ring2, ring3]);

  const ringStyle = (val: Animated.Value) => ({
    transform: [{ scale: val.interpolate({ inputRange: [0, 1], outputRange: [1, RING_SCALE] }) }],
    opacity:   val.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0.6, 0.2, 0] }),
  });

  // ── Animated dots ────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 500);
    return () => clearInterval(t);
  }, []);

  // ── Confirm sheet animation ──────────────────────────────────────────────
  const confirmY      = useRef(new Animated.Value(CONFIRM_H)).current;
  const backdropAlpha = useRef(new Animated.Value(0)).current;

  const openConfirm = () => {
    confirmY.setValue(CONFIRM_H);
    backdropAlpha.setValue(0);
    setShowConfirm(true);
    Animated.parallel([
      Animated.spring(confirmY,      { toValue: 0,    useNativeDriver: true, tension: 70, friction: 11 }),
      Animated.timing(backdropAlpha, { toValue: 0.55, duration: 260, useNativeDriver: true }),
    ]).start();
  };

  const closeConfirm = () => {
    Animated.parallel([
      Animated.timing(confirmY,      { toValue: CONFIRM_H, duration: 240, useNativeDriver: true }),
      Animated.timing(backdropAlpha, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setShowConfirm(false));
  };

  // ── Trip request polling — saves solo trip UUID, does NOT navigate ────────
  const handleRequestMatched = useCallback((tripUuid: string) => {
    setSoloTripUuid(tripUuid);
  }, []);

  useTripPolling(requestUuid, handleRequestMatched);

  // ── Solo trip polling — navigate only when driver actually accepts ─────────
  useEffect(() => {
    if (!soloTripUuid) return;
    let alive = true;

    const poll = async () => {
      if (!alive) return;
      try {
        const trip = await tripsApi.getTrip(soloTripUuid);
        if (trip.status === 'driver_assigned' || trip.status === 'in_progress') {
          if (alive) goToActiveTripRef.current(soloTripUuid);
        }
        if (trip.status === 'cancelled') {
          if (alive) setSoloTripUuid(null);
        }
      } catch {}
    };

    const interval = setInterval(poll, 2000);
    poll();
    return () => { alive = false; clearInterval(interval); };
  }, [soloTripUuid]); // intentionally excludes goToActiveTripRef — it's a ref

  // ── Share polling ─────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;

    const poll = async () => {
      if (!alive) return;
      try {
        // Clear expired incoming banner
        const cur = incomingRef.current;
        if (cur && new Date(cur.expiresAt) < new Date()) {
          incomingRef.current = null;
          setIncoming(null);
        }

        // Check for incoming request from any relevant state (top banner priority)
        const checkIncoming = shareState === 'searching'
          || shareState === 'has-suggestion'
          || shareState === 'waiting';

        if (checkIncoming && !incomingRef.current) {
          const inc = await tripsApi.getIncomingShareRequest(requestUuid);
          if (!alive) return;
          if (inc) {
            incomingRef.current = inc;
            setIncoming(inc);
            // Don't return — continue with state-specific logic below
          }
        }

        // State-specific logic
        if (shareState === 'searching') {
          const nearby = await tripsApi.getNearbyPartner(requestUuid);
          if (!alive) return;
          if (nearby && !ignoredSuggestions.current.has(nearby.requestUuid)) {
            setSuggestion(nearby);
            setShareState('has-suggestion');
          }
        } else if (shareState === 'waiting' && shareUuid) {
          const sr = await tripsApi.getShareRequest(shareUuid);
          if (!alive) return;
          if (sr.status === 'accepted' && sr.combinedTripUuid) {
            goToActiveTripRef.current(sr.combinedTripUuid);
            return;
          }
          if (sr.status === 'rejected') {
            setShareState('rejected');
            setShareUuid(null);
            return;
          }
          if (new Date(sr.expiresAt) < new Date()) {
            setShareState('searching');
            setShareUuid(null);
          }
        }
      } catch {}
    };

    const interval = setInterval(poll, 2000);
    poll();
    return () => { alive = false; clearInterval(interval); };
  // intentionally excludes 'incoming' and goToActiveTripRef — both accessed via refs
  }, [shareState, shareUuid, requestUuid]);

  // 'rejected' → back to searching after 3s
  useEffect(() => {
    if (shareState !== 'rejected') return;
    const t = setTimeout(() => setShareState('searching'), 3000);
    return () => clearTimeout(t);
  }, [shareState]);

  // ── Share actions ─────────────────────────────────────────────────────────
  const handleSendShareRequest = async () => {
    if (!suggestion) return;
    setShareState('acting');
    try {
      const created = await tripsApi.createShareRequest(requestUuid, suggestion.requestUuid);
      setShareUuid(created.uuid);
      setShareState('waiting');
    } catch {
      setShareState('has-suggestion');
    }
  };

  const handleDeclineSuggestion = () => {
    if (suggestion) ignoredSuggestions.current.add(suggestion.requestUuid);
    setSuggestion(null);
    setShareState('searching');
  };

  const handleAcceptIncoming = async () => {
    if (!incoming || incomingActing) return;
    setIncomingActing(true);
    try {
      const res = await tripsApi.acceptShareRequest(incoming.uuid);
      goToActiveTripRef.current(res.combinedTripUuid);
    } catch {
      setIncomingActing(false);
    }
  };

  const handleRejectIncoming = async () => {
    if (!incoming || incomingActing) return;
    setIncomingActing(true);
    try { await tripsApi.rejectShareRequest(incoming.uuid); } finally {
      incomingRef.current = null;
      setIncoming(null);
      setIncomingActing(false);
    }
  };

  // ── Cancel ────────────────────────────────────────────────────────────────
  const handleCancel = useCallback(async () => {
    setCancelling(true);
    try { await tripsApi.cancelRequest(requestUuid); } finally {
      navigation.navigate('CancelledTrip', { routePolyline, originAddress, destAddress, estimatedFare });
    }
  }, [requestUuid, navigation, routePolyline, originAddress, destAddress, estimatedFare]);

  // ── Map data ──────────────────────────────────────────────────────────────
  const waypoints: WaypointDto[] = routePolyline.length >= 2
    ? [
        { lat: routePolyline[0].latitude,                        lng: routePolyline[0].longitude,                        waypointType: 'pickup'  },
        { lat: routePolyline[routePolyline.length - 1].latitude, lng: routePolyline[routePolyline.length - 1].longitude, waypointType: 'dropoff' },
      ]
    : [];

  const mapCoords = routePolyline.length >= 2
    ? routePolyline.map(p => ({ latitude: p.latitude, longitude: p.longitude }))
    : undefined;

  // ── TOP incoming banner (floats above everything) ─────────────────────────
  const renderIncomingBanner = () => {
    if (!incoming) return null;
    return (
      <View style={[S.incomingBanner, shadow('lg')]}>
        <View style={S.incomingBannerTitleRow}>
          <Users size={15} color={T.hi} strokeWidth={2} />
          <Text style={S.incomingBannerTitle}>{incoming.requesterName} quiere compartir tu viaje</Text>
        </View>
        <Text style={S.incomingBannerSub} numberOfLines={1}>↑ {incoming.requesterPickupAddress}</Text>
        <Text style={S.incomingBannerSub} numberOfLines={1}>↓ {incoming.requesterDestinationAddress}</Text>
        {incomingActing
          ? <ActivityIndicator color={T.primary} style={{ marginTop: T.xs }} />
          : (
            <View style={S.shareBtnRow}>
              <TouchableOpacity style={S.declineBtn} onPress={handleRejectIncoming} activeOpacity={0.8}>
                <Text style={S.declineBtnText}>Rechazar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={S.shareBtn} onPress={handleAcceptIncoming} activeOpacity={0.8}>
                <Text style={S.shareBtnText}>Aceptar</Text>
              </TouchableOpacity>
            </View>
          )}
      </View>
    );
  };

  // ── BOTTOM share overlay ──────────────────────────────────────────────────
  const renderShareOverlay = () => {
    if (shareState === 'has-suggestion' && suggestion) {
      return (
        <View style={[S.shareCard, shadow('lg')]}>
          <View style={S.shareCardTitleRow}>
            <Car size={15} color={T.hi} strokeWidth={1.5} />
            <Text style={S.shareCardTitle}>{suggestion.passengerName} va a un lugar similar</Text>
          </View>
          <Text style={S.shareCardSub} numberOfLines={1}>Desde: {suggestion.pickupAddress}</Text>
          <Text style={S.shareCardSub} numberOfLines={1}>Hacia: {suggestion.destinationAddress}</Text>
          <Text style={S.shareCardDist}>{(suggestion.pickupDistanceKm * 1000).toFixed(0)} m de distancia</Text>
          <View style={S.shareBtnRow}>
            <TouchableOpacity style={S.declineBtn} onPress={handleDeclineSuggestion} activeOpacity={0.8}>
              <Text style={S.declineBtnText}>No gracias</Text>
            </TouchableOpacity>
            <TouchableOpacity style={S.shareBtn} onPress={handleSendShareRequest} activeOpacity={0.8}>
              <Text style={S.shareBtnText}>¡Compartir!</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (shareState === 'waiting') {
      return (
        <View style={[S.shareCard, shadow('lg')]}>
          <ActivityIndicator color={T.primary} style={{ marginBottom: 8 }} />
          <Text style={S.shareCardTitle}>Esperando respuesta{dots}</Text>
          <Text style={S.shareCardSub}>El otro pasajero debe aceptar en los próximos segundos.</Text>
          <TouchableOpacity
            style={[S.declineBtn, { marginTop: 8, alignSelf: 'center', flex: 0, paddingHorizontal: 20 }]}
            onPress={() => { setShareUuid(null); setShareState('searching'); }}
            activeOpacity={0.8}
          >
            <Text style={S.declineBtnText}>Cancelar solicitud</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (shareState === 'rejected') {
      return (
        <View style={[S.shareCard, shadow('lg')]}>
          <View style={S.shareCardTitleRow}>
            <X size={15} color={T.error} strokeWidth={2.5} />
            <Text style={[S.shareCardTitle, { color: T.error }]}>Solicitud rechazada</Text>
          </View>
          <Text style={S.shareCardSub}>El pasajero no quiso compartir. Seguimos buscando conductor.</Text>
        </View>
      );
    }

    if (shareState === 'acting') {
      return (
        <View style={[S.shareCard, shadow('lg')]}>
          <ActivityIndicator color={T.primary} />
        </View>
      );
    }

    return null;
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={S.root}>
      <StatusBar style="light" />

      <AuMap
        waypoints={waypoints}
        polyline={mapCoords}
        fitToCoords={mapCoords}
        fitPadding={MAP_PAD}
        style={StyleSheet.absoluteFill}
      />

      <View style={S.radarOverlay} pointerEvents="none">
        <Animated.View style={[S.ring, ringStyle(ring1)]} />
        <Animated.View style={[S.ring, ringStyle(ring2)]} />
        <Animated.View style={[S.ring, ringStyle(ring3)]} />
        <View style={S.radarCore}><MapPin size={20} color={T.primary} strokeWidth={1.5} /></View>
      </View>

      {renderIncomingBanner()}
      {renderShareOverlay()}

      <View style={[S.sheet, shadow('lg')]}>
        <SafeAreaView edges={['bottom']}>
          <View style={S.handleWrap}><View style={S.handle} /></View>
          <View style={S.sheetBody}>
            <Text style={S.sheetTitle}>
              {soloTripUuid ? 'Esperando conductor' : 'La búsqueda comenzó'}
            </Text>
            <Text style={S.sheetSub}>
              {soloTripUuid
                ? ('Un conductor se asignará pronto' + dots)
                : ('Estamos buscando el conductor más cercano' + dots)}
            </Text>

            {showDetails && (
              <View style={S.detailsPanel}>
                {(originAddress || destAddress) ? (
                  <View style={S.routeRow}>
                    <View style={S.routeTrack}>
                      <View style={[S.routeDot, { backgroundColor: T.accent }]} />
                      <View style={S.routeLine} />
                      <View style={[S.routeDot, { backgroundColor: T.error }]} />
                    </View>
                    <View style={S.routeAddresses}>
                      <Text style={S.addrText} numberOfLines={1}>{originAddress || '—'}</Text>
                      <Text style={S.addrText} numberOfLines={1}>{destAddress || '—'}</Text>
                    </View>
                  </View>
                ) : null}
                {estimatedFare != null && (
                  <Text style={S.fareText}>Tarifa estimada: Bs. {Math.round(estimatedFare)}</Text>
                )}
              </View>
            )}

            <View style={S.btnRow}>
              <TouchableOpacity style={[S.actionBtn, S.cancelBtn]} onPress={openConfirm} activeOpacity={0.8}>
                <View style={S.btnInner}>
                  <X size={14} color={T.error} strokeWidth={2.5} />
                  <Text style={S.cancelBtnText}>Cancelar viaje</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[S.actionBtn, S.detailsBtn, showDetails && S.detailsBtnActive]}
                onPress={() => setShowDetails(d => !d)}
                activeOpacity={0.8}
              >
                <View style={S.btnInner}>
                  <List size={14} color={showDetails ? T.primary : T.mid} strokeWidth={2} />
                  <Text style={[S.detailsBtnText, showDetails && S.detailsBtnTextActive]}>Detalles</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>

      {showConfirm && (
        <>
          <Animated.View style={[S.backdrop, { opacity: backdropAlpha }]} pointerEvents="auto">
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeConfirm} />
          </Animated.View>
          <Animated.View style={[S.confirmSheet, shadow('lg'), { transform: [{ translateY: confirmY }] }]}>
            <SafeAreaView edges={['bottom']}>
              <View style={S.handleWrap}><View style={S.handle} /></View>
              <View style={S.confirmBody}>
                <Text style={S.confirmTitle}>¿Confirmás que querés cancelarlo?</Text>
                <Text style={S.confirmSub}>Ya estamos buscando un conductor, no tardará mucho.</Text>
                <View style={S.confirmBtns}>
                  <TouchableOpacity style={S.ghostBtn} onPress={closeConfirm} activeOpacity={0.7}>
                    <Text style={S.ghostBtnText}>Esperar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[S.primaryBtn, cancelling && S.btnDisabled]}
                    onPress={handleCancel}
                    disabled={cancelling}
                    activeOpacity={0.85}
                  >
                    {cancelling
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={S.primaryBtnText}>Cancelar</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </SafeAreaView>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },

  radarOverlay: {
    position: 'absolute', top: SCREEN_H * 0.27,
    left: 0, right: 0, alignItems: 'center', justifyContent: 'center', height: RING_SIZE,
  },
  ring: {
    position: 'absolute', width: RING_SIZE, height: RING_SIZE,
    borderRadius: RING_SIZE / 2, borderWidth: 1.5, borderColor: T.primary,
  },
  radarCore: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: T.primaryDim, alignItems: 'center', justifyContent: 'center',
  },

  // TOP incoming banner
  incomingBanner: {
    position: 'absolute', top: 60, left: T.md, right: T.md,
    backgroundColor: T.card, borderRadius: 20,
    borderWidth: 1.5, borderColor: T.primary + '50',
    padding: T.md, gap: T.xs,
  },
  incomingBannerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  incomingBannerTitle:    { fontSize: 15, fontWeight: '700', color: T.hi, flex: 1 },
  incomingBannerSub:      { fontSize: 13, color: T.mid },

  // BOTTOM share suggestion card
  shareCard: {
    position: 'absolute', bottom: 200, left: T.md, right: T.md,
    backgroundColor: T.card, borderRadius: 20, borderWidth: 1, borderColor: T.border,
    padding: T.md, gap: T.xs,
  },
  shareCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shareCardTitle:    { fontSize: 16, fontWeight: '700', color: T.hi, flex: 1 },
  shareCardSub:      { fontSize: 13, color: T.mid },
  shareCardDist:  { fontSize: 12, color: T.lo, marginTop: 2 },
  shareBtnRow:    { flexDirection: 'row', gap: T.sm, marginTop: T.xs },
  shareBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 12,
    alignItems: 'center', backgroundColor: T.primary,
  },
  shareBtnText:   { fontSize: 14, fontWeight: '700', color: '#fff' },
  declineBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center',
    backgroundColor: T.surf, borderWidth: 1, borderColor: T.border,
  },
  declineBtnText: { fontSize: 14, fontWeight: '600', color: T.mid },

  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: T.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: T.border,
  },
  handleWrap: { alignItems: 'center', paddingTop: T.sm, paddingBottom: T.xs },
  handle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: T.border },

  sheetBody:      { paddingHorizontal: T.md, paddingBottom: T.sm, gap: T.sm },
  sheetTitle:     { fontSize: 20, fontWeight: '800', color: T.hi },
  sheetSub:       { fontSize: 13, color: T.mid, lineHeight: 18 },

  detailsPanel: {
    backgroundColor: T.surf, borderRadius: 12, borderWidth: 1,
    borderColor: T.border, padding: T.sm, gap: T.xs,
  },
  routeRow:       { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  routeTrack:     { alignItems: 'center', paddingVertical: 2 },
  routeDot:       { width: 8, height: 8, borderRadius: 4 },
  routeLine:      { width: 1.5, flex: 1, minHeight: 12, backgroundColor: T.border, marginVertical: 2 },
  routeAddresses: { flex: 1, justifyContent: 'space-between', gap: 6 },
  addrText:       { fontSize: 13, color: T.mid },
  fareText:       { fontSize: 13, fontWeight: '700', color: T.accent, marginTop: 2 },

  btnRow:    { flexDirection: 'row', gap: T.sm },
  actionBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 13,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: T.border, backgroundColor: T.surf,
  },
  cancelBtn:            { borderColor: T.error + '60' },
  btnInner:             { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cancelBtnText:        { fontSize: 14, fontWeight: '600', color: T.error },
  detailsBtn:           {},
  detailsBtnActive:     { backgroundColor: T.primaryDim, borderColor: T.primary + '60' },
  detailsBtnText:       { fontSize: 14, fontWeight: '600', color: T.mid },
  detailsBtnTextActive: { color: T.primary },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },

  confirmSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: T.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: T.border,
  },
  confirmBody:  { paddingHorizontal: T.md, paddingBottom: T.sm, gap: T.md },
  confirmTitle: { fontSize: 18, fontWeight: '800', color: T.hi },
  confirmSub:   { fontSize: 14, color: T.mid, lineHeight: 20 },
  confirmBtns:  { flexDirection: 'row', gap: T.sm },
  ghostBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center',
    backgroundColor: T.surf, borderWidth: 1, borderColor: T.border,
  },
  ghostBtnText:   { fontSize: 15, fontWeight: '600', color: T.mid },
  primaryBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', backgroundColor: T.error,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  btnDisabled:    { opacity: 0.5 },
});
