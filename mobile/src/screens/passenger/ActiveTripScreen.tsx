import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, ScrollView,
  ActivityIndicator, Dimensions, TouchableOpacity,
  StyleProp, ViewStyle, Modal, Linking, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LatLng } from 'react-native-maps';
import { Phone, Info, QrCode, Banknote, X, Check } from 'lucide-react-native';
import { AuMap }        from '../../components/map/AuMap';
import { tripsApi }     from '../../api/trips.api';
import { useTripStore } from '../../store/trip.store';
import { getRouteInfo } from '../../services/directions';
import { Colors }       from '../../theme/colors';
import { Typography }   from '../../theme/typography';
import { Spacing }      from '../../theme/spacing';
import type { TripResponseDto } from '../../api/types';
import type { PassengerStackParamList } from '../../navigation/PassengerNavigator';

type Props = NativeStackScreenProps<PassengerStackParamList, 'ActiveTrip'>;

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function shadow(size: 'sm' | 'md' | 'lg' = 'md') {
  const cfg = { sm: { e: 4, r: 4, o: 0.20 }, md: { e: 8, r: 8, o: 0.25 }, lg: { e: 16, r: 12, o: 0.35 } }[size];
  return { shadowColor: '#000' as const, shadowOffset: { width: 0, height: cfg.e / 2 }, shadowOpacity: cfg.o, shadowRadius: cfg.r, elevation: cfg.e };
}

function carColor(color: string): string {
  const map: Record<string, string> = {
    negro: '#2C2C3A', blanco: '#F5F5F5', rojo: '#E74C3C',
    azul: '#3498DB', verde: '#27AE60', amarillo: '#F1C40F',
    gris: '#7F8C8D', plata: '#BDC3C7', naranja: '#E67E22',
    marron: '#795548', cafe: '#795548', dorado: '#F39C12',
    violeta: '#9B59B6', rosa: '#E91E63',
  };
  return map[color.toLowerCase().replace('ó', 'o').replace('á', 'a')] ?? Colors.textLow;
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

// ── DriverArrivedCard ─────────────────────────────────────────────────────────

const FREE_WAIT_S = 180;

function DriverArrivedCard({ driverName, ratingAverage, plateNumber }: {
  driverName: string;
  ratingAverage: number;
  plateNumber?: string;
}) {
  const mountedAt = useRef(Date.now());
  const [secondsLeft, setSecondsLeft] = useState(FREE_WAIT_S);

  useEffect(() => {
    const t = setInterval(() => {
      const elapsed = Math.floor((Date.now() - mountedAt.current) / 1000);
      setSecondsLeft(Math.max(0, FREE_WAIT_S - elapsed));
    }, 1_000);
    return () => clearInterval(t);
  }, []);

  const mm      = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss      = String(secondsLeft % 60).padStart(2, '0');
  const isLate  = secondsLeft < 60;
  const initials = driverName.trim().split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();

  return (
    <View style={S.daCard}>
      <Text style={S.daTitle}>¡Tu conductor llegó!</Text>
      <View style={S.daDriverRow}>
        <View style={[S.daAvatar, isLate && { backgroundColor: '#FFB34730' }]}>
          <Text style={[S.daAvatarText, { color: isLate ? '#FFB347' : T.primary }]}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={S.daName}>{driverName}</Text>
          <View style={S.daRatingRow}>
            <Text style={S.daRatingStar}>★</Text>
            <Text style={S.daRatingVal}>{ratingAverage.toFixed(1)}</Text>
          </View>
        </View>
        {plateNumber && (
          <View style={S.daPlateBadge}>
            <Text style={S.daPlateText}>{plateNumber}</Text>
          </View>
        )}
      </View>
      <View style={S.daTimerWrap}>
        <Text style={[S.daTimer, isLate && S.daTimerLate]}>{mm}:{ss}</Text>
        <Text style={S.daTimerLabel}>tiempo de espera</Text>
      </View>
      {isLate && <Text style={S.daLateHint}>El conductor tiene poco tiempo de espera libre</Text>}
    </View>
  );
}

// ── DetailsModal ──────────────────────────────────────────────────────────────

function DetailsModal({
  visible, onClose, trip,
}: {
  visible: boolean;
  onClose: () => void;
  trip: TripResponseDto;
}) {
  const { driver, vehicle } = trip;
  if (!driver) return null;

  const initials = driver.fullName.trim().split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
  const plateColor = vehicle ? carColor(vehicle.color) : T.lo;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={S.modalOverlay}>
        <View style={S.modalCard}>
          {/* Avatar */}
          <View style={S.modalAvatar}>
            <Text style={S.modalAvatarText}>{initials}</Text>
          </View>

          {/* Name + rating */}
          <Text style={S.modalName}>{driver.fullName}</Text>
          <View style={S.modalRatingRow}>
            <Text style={S.modalRatingStar}>★</Text>
            <Text style={S.modalRatingVal}>{driver.ratingAverage.toFixed(1)}</Text>
          </View>

          {/* LARGE plate */}
          {vehicle && (
            <View style={[S.modalPlateLarge, { borderColor: plateColor }]}>
              <View style={[S.modalPlateColorBar, { backgroundColor: plateColor }]} />
              <Text style={S.modalPlateNumber}>{vehicle.plateNumber}</Text>
            </View>
          )}

          {/* Vehicle info */}
          {vehicle && (
            <View style={S.modalVehicleRow}>
              <Text style={S.modalVehicleText}>
                {vehicle.brand} {vehicle.model} · {vehicle.year} · {vehicle.color}
              </Text>
            </View>
          )}

          {/* Phone (text only) */}
          {driver.phone ? (
            <View style={S.modalPhoneRow}>
              <Phone size={18} color={Colors.textMid} strokeWidth={1.5} />
              <Text style={S.modalPhoneText}>{driver.phone}</Text>
            </View>
          ) : null}

          {/* Close */}
          <TouchableOpacity style={S.modalCloseBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={S.modalCloseBtnText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const POLL_MS        = 4_000;
const FALLBACK_ETA_S = 600;
const SHEET_H        = Math.round(Dimensions.get('window').height * 0.58);

const STATUS_LABEL: Record<string, string> = {
  scheduled:       'Buscando conductor...',
  driver_assigned: 'Conductor en camino',
  in_progress:     'En camino a destino',
  completed:       'Viaje completado',
  cancelled:       'Viaje cancelado',
};

// ── Screen ────────────────────────────────────────────────────────────────────

export function ActiveTripScreen({ route, navigation }: Props) {
  const { tripUuid, routePolyline: paramPolyline } = route.params;
  const insets = useSafeAreaInsets();

  const [trip, setTrip]             = useState<TripResponseDto | null>(null);
  const [routePolyline, setRoutePolyline] = useState<LatLng[]>(paramPolyline ?? []);
  const [loading, setLoading]       = useState(true);
  const [showDetails, setShowDetails]   = useState(false);
  const [cancelling, setCancelling]     = useState(false);
  const [elapsed, setElapsed]           = useState(0);
  const mountedAt                       = useRef(Date.now());

  // Live dot pulse
  const livePulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, { toValue: 0.15, duration: 900, useNativeDriver: true }),
        Animated.timing(livePulse, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [livePulse]);

  // Next-stop dot pulse
  const dotPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulse, { toValue: 0.25, duration: 700, useNativeDriver: true }),
        Animated.timing(dotPulse, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [dotPulse]);

  // Elapsed counter
  useEffect(() => {
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - mountedAt.current) / 1000));
    }, 1_000);
    return () => clearInterval(t);
  }, []);

  // Trip polling
  const handleTripData = useCallback((data: TripResponseDto) => {
    setTrip(data);
    useTripStore.getState().setActiveTrip(data);
    if (data.status === 'completed') {
      navigation.replace('Rating', {
        tripUuid,
        driverUuid:    data.driver?.driverUuid ?? '',
        driverName:    data.driver?.fullName,
        fare:          data.fareAmount,
        paymentMethod: data.paymentMethod,
      });
    }
    // No navigate on cancelled — show the cancelled state in-screen
  }, [tripUuid, navigation]);

  useEffect(() => {
    tripsApi.getTrip(tripUuid)
      .then(handleTripData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tripUuid, handleTripData]);

  useEffect(() => {
    const t = setInterval(() => {
      tripsApi.getTrip(tripUuid).then(handleTripData).catch(() => {});
    }, POLL_MS);
    return () => clearInterval(t);
  }, [tripUuid, handleTripData]);

  // Real-road polyline
  useEffect(() => {
    if (!trip) return;
    const { originLat, originLng, destinationLat, destinationLng } = trip;
    if (!originLat || !destinationLat) return;
    getRouteInfo(
      { latitude: originLat,      longitude: originLng      },
      { latitude: destinationLat, longitude: destinationLng },
    ).then(info => setRoutePolyline(info.polyline)).catch(() => {});
  }, [trip?.tripUuid]);

  // Action handlers
  const handleCall = () => {
    const phone = trip?.driver?.phone;
    if (!phone) { Alert.alert('Sin número', 'El conductor no tiene número registrado.'); return; }
    Linking.openURL(`tel:${phone}`).catch(() =>
      Alert.alert('Error', 'No se pudo abrir el marcador de llamadas.'));
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancelar viaje',
      '¿Estás seguro de que querés cancelar este viaje?',
      [
        { text: 'Esperar', style: 'cancel' },
        {
          text: 'Cancelar viaje',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await tripsApi.cancelTrip(tripUuid);
            } catch {}
            finally { setCancelling(false); }
          },
        },
      ]
    );
  };

  // ── Loading / null guards ─────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={S.loadingWrap}>
        <ActivityIndicator size="large" color={T.primary} />
      </View>
    );
  }
  if (!trip) return null;

  // ── Derived values ────────────────────────────────────────────────────────

  const totalSecs  = trip.estimatedArrivalSeconds > 0 ? trip.estimatedArrivalSeconds : FALLBACK_ETA_S;
  const remainSecs = Math.max(0, totalSecs - elapsed);
  const eta        = Math.ceil(remainSecs / 60);

  const driverArrived = !!trip.arrivedAt && trip.status === 'driver_assigned';
  const hasDriver     = !!trip.driver;
  const hasVehicle    = !!trip.vehicle;

  const sorted  = [...(trip.passengers ?? [])].sort((a, b) => a.pickupOrder - b.pickupOrder);
  const total   = sorted.length;
  const done    = sorted.filter(p => p.status === 'dropped_off').length;
  const nextIdx = sorted.findIndex(p => p.status !== 'dropped_off');
  const stopsProgress = total > 0 ? done / total : 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={S.safe}>
      <StatusBar style="light" />

      {/* Fullscreen map */}
      <AuMap waypoints={trip.route} polyline={routePolyline} style={StyleSheet.absoluteFill} />

      {/* ── Floating Header ── */}
      {hasDriver && hasVehicle && (
        <View style={[S.floatingHeader, shadow('md'), { top: insets.top + 8 }]}>
          <View style={[S.floatingColorDot, { backgroundColor: carColor(trip.vehicle!.color) }]} />
          <Text style={S.floatingModel} numberOfLines={1}>
            {trip.vehicle!.brand} {trip.vehicle!.model}
          </Text>
          <View style={S.floatingPlateCapsule}>
            <Text style={S.floatingPlateText}>{trip.vehicle!.plateNumber}</Text>
          </View>
          <View style={S.floatingEtaChip}>
            <Text style={S.floatingEtaText}>
              {driverArrived ? '¡Llegó!' : (eta > 0 ? `${eta} min` : '¡Ya!')}
            </Text>
          </View>
        </View>
      )}

      {/* ── Bottom sheet ── */}
      <View style={[S.sheet, shadow('lg')]}>
        <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>

          {/* Handle */}
          <View style={S.handleWrap}>
            <View style={S.handle} />
          </View>

          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={S.sheetContent}
          >
            {/* ── Sheet header (status + ETA) ── */}
            <View style={S.sheetHeader}>
              <View style={S.headerLeft}>
                {trip.isPooled && (
                  <View style={S.poolBadge}>
                    <Text style={S.poolBadgeText}>
                      Viaje compartido · {trip.totalPassengers} pasajeros
                    </Text>
                  </View>
                )}
                <Text style={[S.statusText, driverArrived && { color: T.warning, fontWeight: '700' }]}>
                  {driverArrived ? '¡Conductor llegó!' : (STATUS_LABEL[trip.status] ?? trip.status)}
                </Text>
              </View>
              {!hasVehicle && (
                <View style={[S.etaChip, driverArrived && S.etaChipArrived]}>
                  <Text style={[S.etaChipText, driverArrived && { color: T.warning }]}>
                    {driverArrived ? '¡Llegó!' : (eta > 0 ? `${eta} min` : 'Llegando')}
                  </Text>
                </View>
              )}
            </View>

            {/* ── Driver arrived card OR regular driver card ── */}
            {driverArrived && trip.driver ? (
              <DriverArrivedCard
                driverName={trip.driver.fullName}
                ratingAverage={trip.driver.ratingAverage}
                plateNumber={trip.vehicle?.plateNumber}
              />
            ) : (
              trip.driver && (
                <View style={[S.driverCard, shadow('sm')]}>
                  <View style={S.driverRow}>
                    <View style={S.driverAvatar}>
                      <Text style={S.driverInitial}>
                        {trip.driver.fullName.trim().charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={S.driverInfo}>
                      <Text style={S.driverName}>{trip.driver.fullName}</Text>
                      <View style={S.ratingRow}>
                        <Text style={S.ratingStar}>★</Text>
                        <Text style={S.ratingVal}>{trip.driver.ratingAverage.toFixed(1)}</Text>
                      </View>
                    </View>
                    <Animated.View style={[S.liveDot, { opacity: livePulse }]} />
                    {trip.vehicle && (
                      <View style={S.plateBadge}>
                        <Text style={S.plateText}>{trip.vehicle.plateNumber}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )
            )}

            {/* ── Action buttons ── */}
            {hasDriver && (
              <View style={S.actionRow}>
                <TouchableOpacity style={S.actionBtn} onPress={handleCall} activeOpacity={0.75}>
                  <Phone size={22} color={T.mid} strokeWidth={1.5} />
                  <Text style={S.actionLabel}>Llamar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[S.actionBtn, S.actionBtnDetails]} onPress={() => setShowDetails(true)} activeOpacity={0.75}>
                  <Info size={22} color={T.primary} strokeWidth={1.5} />
                  <Text style={[S.actionLabel, { color: T.primary }]}>Detalles</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Cancel button (only before trip starts) ── */}
            {(trip.status === 'scheduled' || trip.status === 'driver_assigned') && (
              <TouchableOpacity
                style={[S.cancelBtn, cancelling && S.btnDisabled]}
                onPress={handleCancel}
                disabled={cancelling}
                activeOpacity={0.75}
              >
                {cancelling
                  ? <ActivityIndicator color={T.error} size="small" />
                  : <Text style={S.cancelBtnText}>Cancelar viaje</Text>
                }
              </TouchableOpacity>
            )}

            {/* ── Cancelled state ── */}
            {trip.status === 'cancelled' && (
              <View style={S.cancelledCard}>
                <X size={36} color={T.error} strokeWidth={2} />
                <Text style={S.cancelledTitle}>Viaje cancelado</Text>
                <Text style={S.cancelledSub}>Este viaje fue cancelado y no se sumará a tu historial de viajes.</Text>
                <TouchableOpacity style={S.cancelledBackBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
                  <Text style={S.cancelledBackText}>Volver al inicio</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Fare card during in_progress ── */}
            {trip.status === 'in_progress' && (
              <View style={S.fareProgressCard}>
                <View style={S.fpRow}>
                  <View>
                    <Text style={S.fpLabel}>Total del viaje</Text>
                    <Text style={S.fpAmt}>Bs. {Math.round(trip.fareAmount)}</Text>
                  </View>
                  <View style={S.fpEtaBadge}>
                    <Text style={S.fpEtaText}>{eta > 0 ? `${eta} min` : '¡Llegando!'}</Text>
                  </View>
                </View>
                <View style={S.hairline} />
                <View style={S.fpPayRow}>
                  {trip.paymentMethod === 'qr'
                    ? <QrCode size={16} color={T.mid} strokeWidth={1.5} />
                    : <Banknote size={16} color={T.mid} strokeWidth={1.5} />}
                  <Text style={S.fpPayText}>{trip.paymentMethod === 'qr' ? 'Cobro por QR' : 'Cobro en efectivo'}</Text>
                </View>
              </View>
            )}

            {/* ── Hairline ── */}
            <View style={S.hairline} />

            {/* ── Progress ── */}
            {total > 0 && (
              <>
                <View style={S.progressHeader}>
                  <Text style={Typography.label}>Paradas</Text>
                  <Text style={S.progressFraction}>{done}/{total}</Text>
                </View>
                <View style={S.progressTrack}>
                  <View style={[S.progressFill, { width: `${stopsProgress * 100}%` as any }]} />
                </View>
              </>
            )}

            {/* ── Stops ── */}
            {sorted.length > 0 && (
              <View style={S.stopsList}>
                {sorted.map((p, i) => {
                  const isDone = p.status === 'dropped_off';
                  const isNext = !isDone && i === nextIdx;
                  const addr   = p.status === 'picked_up' ? p.dropoffAddress : p.pickupAddress;
                  return (
                    <View key={p.passengerUuid ?? i} style={[S.stopRow, i > 0 && S.stopBorder]}>
                      {isNext
                        ? <Animated.View style={[S.stopDot, { backgroundColor: T.primary, opacity: dotPulse }]} />
                        : <View style={[S.stopDot, { backgroundColor: isDone ? T.accent : T.border }]} />
                      }
                      <View style={S.stopContent}>
                        {isNext && <Text style={S.nextLabel}>Próxima parada</Text>}
                        <Text style={[S.stopAddr, isDone && S.stopAddrDone]} numberOfLines={2}>{addr}</Text>
                      </View>
                      {isDone && <Check size={15} color={T.accent} strokeWidth={2.5} />}
                    </View>
                  );
                })}
              </View>
            )}

          </ScrollView>
        </SafeAreaView>
      </View>

      {/* ── Details Modal ── */}
      {trip.driver && (
        <DetailsModal
          visible={showDetails}
          onClose={() => setShowDetails(false)}
          trip={trip}
        />
      )}

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: T.bg },
  loadingWrap: { flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' },

  // Floating header
  floatingHeader: {
    position:         'absolute',
    left: 12, right: 12,
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  T.card,
    borderRadius:     50,
    borderWidth:      1,
    borderColor:      T.border,
    paddingHorizontal:16,
    paddingVertical:  10,
    gap:              8,
  },
  floatingColorDot: { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },
  floatingModel:    { flex: 1, fontSize: 13, fontWeight: '600', color: T.hi },
  floatingPlateCapsule: {
    backgroundColor:  T.surf,
    borderRadius:     8,
    borderWidth:      1,
    borderColor:      T.border,
    paddingHorizontal:8,
    paddingVertical:  3,
  },
  floatingPlateText: { fontSize: 12, fontWeight: '700', color: T.hi, letterSpacing: 0.5 },
  floatingEtaChip: {
    backgroundColor:  T.primaryDim,
    borderRadius:     20,
    paddingHorizontal:10,
    paddingVertical:  4,
  },
  floatingEtaText: { fontSize: 13, fontWeight: '700', color: T.primary },

  // Bottom sheet
  sheet: {
    position:            'absolute',
    bottom: 0, left: 0, right: 0,
    height:              SHEET_H,
    backgroundColor:     T.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius:24,
    borderWidth:         1,
    borderColor:         T.border,
  },
  handleWrap:   { alignItems: 'center', paddingTop: T.sm, paddingBottom: T.xs },
  handle:       { width: 40, height: 4, borderRadius: 2, backgroundColor: T.border },
  sheetContent: { paddingHorizontal: T.md, paddingBottom: T.md, gap: T.md },

  // Sheet header
  sheetHeader: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    justifyContent:'space-between',
    gap:           T.sm,
  },
  headerLeft: { flex: 1, gap: T.xs },
  poolBadge:  {
    alignSelf:        'flex-start',
    backgroundColor:  T.accentDim,
    borderRadius:     20,
    paddingHorizontal:10,
    paddingVertical:  4,
  },
  poolBadgeText: { fontSize: 12, fontWeight: '600', color: T.accent },
  statusText:    { fontSize: 13, color: T.mid },
  etaChip: {
    backgroundColor:  T.primaryDim,
    borderRadius:     20,
    paddingHorizontal:12,
    paddingVertical:  6,
  },
  etaChipText:    { fontSize: 15, fontWeight: '700', color: T.primary },
  etaChipArrived: { backgroundColor: Colors.warningDim },

  // Driver card
  driverCard: {
    backgroundColor: T.surf,
    borderRadius:    16,
    borderWidth:     1,
    borderColor:     T.border,
    padding:         T.md,
  },
  driverRow:    { flexDirection: 'row', alignItems: 'center', gap: T.sm },
  driverAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: T.primaryDim,
    alignItems: 'center', justifyContent: 'center',
  },
  driverInitial: { fontSize: 18, fontWeight: '700', color: T.primary },
  driverInfo:    { flex: 1 },
  driverName:    { fontSize: 15, fontWeight: '600', color: T.hi, marginBottom: 2 },
  ratingRow:     { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingStar:    { fontSize: 13, color: T.warning },
  ratingVal:     { fontSize: 13, fontWeight: '600', color: T.mid },
  liveDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: T.accent,
  },
  plateBadge: {
    backgroundColor:  T.card,
    borderRadius:     8,
    borderWidth:      1,
    borderColor:      T.border,
    paddingHorizontal:8,
    paddingVertical:  3,
  },
  plateText: { fontSize: 13, fontWeight: '700', color: T.hi, letterSpacing: 0.5 },

  // Action buttons
  actionRow: {
    flexDirection: 'row',
    gap:           T.sm,
  },
  actionBtn: {
    flex: 1,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: T.surf,
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     T.border,
    paddingVertical: 12,
    gap:             4,
  },
  actionBtnDetails: {
    borderColor: T.primaryDim,
    backgroundColor: T.primaryDim,
  },
  actionLabel: { fontSize: 12, fontWeight: '600', color: T.mid },

  // Hairline
  hairline: { height: 1, backgroundColor: T.border },

  // Progress
  progressHeader: {
    flexDirection: 'row',
    justifyContent:'space-between',
    alignItems:    'center',
    marginBottom:  T.xs,
  },
  progressFraction: { fontSize: 13, fontWeight: '600', color: T.mid },
  progressTrack: {
    height: 6, backgroundColor: T.border, borderRadius: 3, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', backgroundColor: T.accent, borderRadius: 3,
  },

  // Stops
  stopsList: { gap: 0 },
  stopRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           T.sm,
    paddingVertical: 12,
  },
  stopBorder:    { borderTopWidth: 1, borderTopColor: T.border },
  stopDot:       { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  stopContent:   { flex: 1, gap: 2 },
  nextLabel:     { fontSize: 11, fontWeight: '700', color: T.primary, textTransform: 'uppercase', letterSpacing: 0.6 },
  stopAddr:      { fontSize: 14, color: T.mid, lineHeight: 19 },
  stopAddrDone:  { color: T.lo, textDecorationLine: 'line-through' },

  // Shared buttons
  btnBase:        { borderRadius: 12, paddingVertical: 14, paddingHorizontal: T.md, alignItems: 'center', justifyContent: 'center' },
  btnPrimary:     { backgroundColor: T.primary },
  btnDisabled:    { opacity: 0.5 },
  btnPrimaryText: { fontSize: 15, fontWeight: '600', color: T.hi },
  btnGhost:       { backgroundColor: 'transparent' },
  btnGhostText:   { fontSize: 15, fontWeight: '600' },

  // DriverArrivedCard
  daCard: {
    backgroundColor: Colors.warningDim,
    borderRadius: 20, borderWidth: 2, borderColor: Colors.warning,
    padding: Spacing.md, gap: Spacing.sm, alignItems: 'center',
  },
  daTitle:      { fontSize: 18, fontWeight: '800', color: T.hi },
  daDriverRow:  { flexDirection: 'row', alignItems: 'center', gap: T.sm, width: '100%' as any },
  daAvatar:     { width: 56, height: 56, borderRadius: 28, backgroundColor: T.primaryDim, alignItems: 'center', justifyContent: 'center' },
  daAvatarText: { fontSize: 22, fontWeight: '800' },
  daName:       { fontSize: 15, fontWeight: '700', color: T.hi },
  daRatingRow:  { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  daRatingStar: { fontSize: 12, color: T.warning },
  daRatingVal:  { fontSize: 12, fontWeight: '600', color: T.mid },
  daPlateBadge: { backgroundColor: T.card, borderRadius: 8, borderWidth: 1, borderColor: T.border, paddingHorizontal: 8, paddingVertical: 4 },
  daPlateText:  { fontSize: 13, fontWeight: '700', color: T.hi, letterSpacing: 0.5 },
  daTimerWrap:  { alignItems: 'center', gap: 2, paddingVertical: T.xs },
  daTimer:      { fontSize: 56, fontWeight: '900', color: Colors.textHigh, fontVariant: ['tabular-nums'] as any, letterSpacing: 2 },
  daTimerLate:  { color: Colors.warning },
  daTimerLabel: { fontSize: 11, fontWeight: '700', color: T.lo, textTransform: 'uppercase' as any, letterSpacing: 0.8 },
  daLateHint:   { fontSize: 11, color: '#FFB347', textAlign: 'center' },

  // Fare card
  fareProgressCard: { backgroundColor: T.surf, borderRadius: 16, borderWidth: 1, borderColor: T.border, padding: T.md, gap: T.sm },
  fpRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fpLabel:   { fontSize: 12, color: T.lo, fontWeight: '500', marginBottom: 2 },
  fpAmt:     { fontSize: 30, fontWeight: '900', color: T.accent, fontVariant: ['tabular-nums'] as any },
  fpEtaBadge:{ backgroundColor: T.primaryDim, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  fpEtaText: { fontSize: 15, fontWeight: '700', color: T.primary },
  fpPayRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fpPayText: { fontSize: 13, fontWeight: '600', color: T.mid },

  // Details modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent:  'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.card,
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    borderWidth:          1,
    borderColor:          Colors.border,
    padding:              Spacing.lg,
    alignItems:           'center',
    gap:                  Spacing.sm,
  },
  modalAvatar: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Colors.primaryDim,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  modalAvatarText: { fontSize: 34, fontWeight: '800', color: Colors.primary },
  modalName: { fontSize: 22, fontWeight: '700', color: Colors.textHigh, textAlign: 'center' },
  modalRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  modalRatingStar: { fontSize: 18, color: Colors.warning },
  modalRatingVal:  { fontSize: 18, fontWeight: '700', color: Colors.textMid },

  // Large plate
  modalPlateLarge: {
    borderRadius:    16,
    borderWidth:     2,
    overflow:        'hidden',
    marginVertical:  Spacing.sm,
    alignItems:      'center',
    minWidth:        180,
  },
  modalPlateColorBar: { width: '100%', height: 8 },
  modalPlateNumber: {
    fontSize:        40,
    fontWeight:      '900',
    color:           Colors.textHigh,
    letterSpacing:   4,
    paddingHorizontal: Spacing.lg,
    paddingVertical:   Spacing.md,
    fontVariant:     ['tabular-nums'] as any,
  },

  modalVehicleRow: {
    backgroundColor: Colors.surface,
    borderRadius:    12,
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.sm,
    width:           '100%',
  },
  modalVehicleText: { fontSize: 14, color: Colors.textMid, textAlign: 'center' },

  modalPhoneRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surface,
    borderRadius:    12,
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.sm,
    width: '100%',
  },
  modalPhoneText: { fontSize: 16, fontWeight: '600', color: Colors.textHigh },

  modalCloseBtn: {
    marginTop:       Spacing.sm,
    width:           '100%',
    paddingVertical: 14,
    borderRadius:    16,
    borderWidth:     1,
    borderColor:     Colors.border,
    alignItems:      'center',
  },
  modalCloseBtnText: { fontSize: 15, fontWeight: '600', color: Colors.textMid },

  // Cancel button
  cancelBtn: {
    borderRadius:    12,
    paddingVertical: 13,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     T.error,
    backgroundColor: T.errorDim,
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: T.error },

  // Cancelled state card
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
    marginTop:       T.sm,
    backgroundColor: T.surf,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     T.border,
    paddingVertical: 12,
    paddingHorizontal: T.lg,
  },
  cancelledBackText: { fontSize: 14, fontWeight: '600', color: T.hi },

  // Address row (unused but kept for consistency)
  routeRow:       { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  routeTrack:     { alignItems: 'center', paddingVertical: 2 },
  routeDot:       { width: 10, height: 10, borderRadius: 5 },
  routeLine:      { width: 2, flex: 1, minHeight: 18, backgroundColor: T.border, marginVertical: 3 },
  routeAddresses: { flex: 1, justifyContent: 'space-between', gap: 12 },
  addressText:    { fontSize: 14, color: T.mid, lineHeight: 19 },
});
