import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Check, Car, Users, Banknote } from 'lucide-react-native';
import { RatingCard }      from '../../components/trip/RatingScreen';
import { useDriverStore }  from '../../store/driver.store';
import { tripsApi }        from '../../api/trips.api';
import { Colors }          from '../../theme/colors';
import { Spacing }         from '../../theme/spacing';
import type { DriverStackParamList } from '../../navigation/DriverNavigator';

type Props = NativeStackScreenProps<DriverStackParamList, 'TripCompletion'>;

const T = {
  bg:      Colors.bgPrimary,
  surf:    Colors.surface,
  card:    Colors.card,
  border:  Colors.border,
  primary: Colors.primary,
  accent:  Colors.accent,
  hi:      Colors.textHigh,
  mid:     Colors.textMid,
  lo:      Colors.textLow,
  xs: Spacing.xs, sm: Spacing.sm, md: Spacing.md, lg: Spacing.lg,
} as const;

const { height: SCREEN_H } = Dimensions.get('window');

// Simple decorative QR-like grid
function QRPlaceholder({ color }: { color: string }) {
  const cells = Array.from({ length: 81 }, (_, i) => {
    // Corners and random fill pattern
    const row = Math.floor(i / 9);
    const col = i % 9;
    const isCorner =
      (row < 3 && col < 3) || (row < 3 && col > 5) || (row > 5 && col < 3);
    const filled = isCorner || Math.random() > 0.55;
    return filled;
  });
  return (
    <View style={QR.grid}>
      {cells.map((filled, i) => (
        <View
          key={i}
          style={[QR.cell, filled && { backgroundColor: color }]}
        />
      ))}
    </View>
  );
}

const QR = StyleSheet.create({
  grid: {
    width: 144, height: 144,
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 2,
    borderColor: '#444',
    borderRadius: 4,
    padding: 2,
    backgroundColor: '#fff',
  },
  cell: { width: 14, height: 14, margin: 1, borderRadius: 1 },
});

export function TripCompletionScreen({ route, navigation }: Props) {
  const { fare, paymentMethod, isPooled, tripUuid, passengerUuid, passengerName } = route.params;

  // Entrance animation
  const slideAnim  = useRef(new Animated.Value(SCREEN_H)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  // Animated checkmark: ring scales in first, then tick pops
  const ringScale  = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  // Fare count-up
  const [displayFare, setDisplayFare] = useState(0);
  // Passenger rating
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 50, friction: 9 }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start(() => {
      Animated.sequence([
        Animated.spring(ringScale,  { toValue: 1, tension: 80,  friction: 7, useNativeDriver: true }),
        Animated.spring(checkScale, { toValue: 1, tension: 220, friction: 8, useNativeDriver: true }),
      ]).start();
    });

    // Count-up animation for fare
    const steps = 40;
    const interval = 600 / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      setDisplayFare(Math.round((fare / steps) * step * 100) / 100);
      if (step >= steps) clearInterval(timer);
    }, interval);
    return () => clearInterval(timer);
  }, [fare]);

  const handleGoHome = async () => {
    await useDriverStore.getState().setCurrentTripUuid(null);
    navigation.navigate('Tabs');
  };

  const isQR = paymentMethod === 'qr';

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: T.bg, opacity: fadeAnim }]}>
      <StatusBar style="light" />
      <Animated.View style={[S.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <SafeAreaView style={S.safeOuter} edges={['top', 'bottom']}>
          <ScrollView
            contentContainerStyle={S.safe}
            showsVerticalScrollIndicator={false}
          >

          {/* Animated checkmark */}
          <View style={S.iconWrap}>
            <Animated.View style={[S.ring, { transform: [{ scale: ringScale }] }]}>
              <Animated.View style={{ transform: [{ scale: checkScale }] }}>
                <Check size={42} color={T.accent} strokeWidth={3} />
              </Animated.View>
            </Animated.View>
          </View>

          <Text style={S.title}>¡Viaje completado!</Text>
          <View style={S.subtitleRow}>
            {isPooled
              ? <Users size={15} color={T.mid} strokeWidth={1.5} />
              : <Car size={15} color={T.mid} strokeWidth={1.5} />}
            <Text style={S.subtitle}>{isPooled ? 'Viaje compartido' : 'Viaje individual'}</Text>
          </View>

          {/* Fare card */}
          <View style={S.fareCard}>
            <Text style={S.fareLabel}>Monto del viaje</Text>
            <Text style={S.fareAmount}>Bs. {Math.round(displayFare)}</Text>
          </View>

          {/* Payment method */}
          <View style={[S.payCard, isQR && S.payCardQR]}>
            {isQR ? (
              <>
                <Text style={S.payTitle}>Cobro por QR</Text>
                <Text style={S.paySub}>Mostrá este QR al pasajero</Text>
                <View style={S.qrWrap}>
                  <QRPlaceholder color="#111" />
                </View>
                <Text style={S.payHint}>El pasajero escaneará tu QR de pago personal</Text>
              </>
            ) : (
              <>
                <Banknote size={32} color={T.hi} strokeWidth={1.5} />
                <Text style={S.payTitle}>Cobro en efectivo</Text>
                <Text style={S.paySub}>Cobrá Bs. {Math.round(fare)} al pasajero</Text>
              </>
            )}
          </View>

          {/* Rating section */}
          {passengerUuid && !ratingSubmitted && (
            <RatingCard
              targetName={passengerName}
              onSubmit={async (score, comment) => {
                if (!passengerUuid || !tripUuid) return;
                await tripsApi.submitRating({ tripUuid, ratedUserUuid: passengerUuid, score, comment });
                setRatingSubmitted(true);
              }}
              onSkip={handleGoHome}
            />
          )}

          {passengerUuid && ratingSubmitted && (
            <Text style={S.ratingThanks}>¡Gracias por tu calificación!</Text>
          )}

          <TouchableOpacity style={S.doneBtn} onPress={handleGoHome} activeOpacity={0.85}>
            <Text style={S.doneBtnText}>Volver al inicio</Text>
          </TouchableOpacity>

          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </Animated.View>
  );
}

const S = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: T.bg,
  },
  safeOuter: { flex: 1 },
  safe: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
  iconWrap: { marginBottom: Spacing.xs },
  ring: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: T.accent + '22',
    borderWidth: 3, borderColor: T.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  title:       { fontSize: 26, fontWeight: '800', color: T.hi },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  subtitle:    { fontSize: 14, color: T.mid },

  fareCard: {
    width: '100%',
    backgroundColor: T.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.border,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: 4,
  },
  fareLabel:  { fontSize: 13, color: T.lo, fontWeight: '500' },
  fareAmount: { fontSize: 48, fontWeight: '900', color: T.accent, fontVariant: ['tabular-nums'] },

  payCard: {
    width: '100%',
    backgroundColor: T.surf,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  payCardQR:  { borderColor: T.primary + '80' },
  payTitle:   { fontSize: 16, fontWeight: '700', color: T.hi },
  paySub:     { fontSize: 13, color: T.mid },
  payHint:    { fontSize: 11, color: T.lo, textAlign: 'center' },
  qrWrap:     { padding: 8, backgroundColor: '#fff', borderRadius: 8 },

  doneBtn: {
    width: '100%',
    backgroundColor: T.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  doneBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  ratingThanks: { fontSize: 14, fontWeight: '600', color: T.accent },
});
