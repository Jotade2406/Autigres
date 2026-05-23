import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import {
  Check, QrCode, Banknote,
  Leaf, Sparkles, Music2, MessageCircle, Clock, Shield, Smile, Map, VolumeX,
} from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { tripsApi }     from '../../api/trips.api';
import { useTripStore } from '../../store/trip.store';
import { Colors }       from '../../theme/colors';
import { Spacing }      from '../../theme/spacing';
import type { PassengerStackParamList } from '../../navigation/PassengerNavigator';

type Props = NativeStackScreenProps<PassengerStackParamList, 'Rating'>;

// ── Design tokens ──────────────────────────────────────────────────────────────

const T = {
  bg:         Colors.bgPrimary,
  surf:       Colors.surface,
  card:       Colors.card,
  border:     Colors.border,
  primary:    Colors.primary,
  primaryDim: Colors.primaryDim,
  accent:     Colors.accent,
  accentDim:  Colors.accentDim,
  warning:    Colors.warning,
  hi:         Colors.textHigh,
  mid:        Colors.textMid,
  lo:         Colors.textLow,
  xs: Spacing.xs, sm: Spacing.sm, md: Spacing.md, lg: Spacing.lg,
} as const;

// ── Data ───────────────────────────────────────────────────────────────────────

const SCORES = [1, 2, 3, 4, 5] as const;
const SCORE_LABELS: Record<number, string> = {
  1: 'Muy malo', 2: 'Malo', 3: 'Regular', 4: 'Bueno', 5: '¡Excelente!',
};

type IconComponent = React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
interface Tag { id: string; Icon: IconComponent; label: string }
const TAGS: Tag[] = [
  { id: 'smell',    Icon: Leaf,          label: 'Buen olor'               },
  { id: 'clean',    Icon: Sparkles,      label: 'Ordenado y limpio'       },
  { id: 'music',    Icon: Music2,        label: 'Buena música'            },
  { id: 'chat',     Icon: MessageCircle, label: 'Conversación agradable'  },
  { id: 'punctual', Icon: Clock,         label: 'Puntual'                 },
  { id: 'safe',     Icon: Shield,        label: 'Conducción segura'       },
  { id: 'friendly', Icon: Smile,         label: 'Amable y cortés'         },
  { id: 'route',    Icon: Map,           label: 'Buena ruta'              },
  { id: 'quiet',    Icon: VolumeX,       label: 'Tranquilo'               },
];

const { height: SCREEN_H } = Dimensions.get('window');

// ── Screen ─────────────────────────────────────────────────────────────────────

export function RatingScreen({ route, navigation }: Props) {
  const { tripUuid, driverUuid, driverName, fare, paymentMethod } = route.params;
  const { clearTrip } = useTripStore();

  const [score,    setScore]    = useState<1|2|3|4|5>(5);
  const [tags,     setTags]     = useState<Set<string>>(new Set());
  const [loading,  setLoading]  = useState(false);

  // Star bounce animations
  const starAnims = useRef(SCORES.map(() => new Animated.Value(1))).current;
  // Sheet slide-up on mount
  const slideAnim = useRef(new Animated.Value(SCREEN_H * 0.6)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 4, speed: 16 }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleStarPress = (s: typeof SCORES[number]) => {
    setScore(s);
    SCORES.forEach((star, i) => {
      if (star <= s) {
        Animated.sequence([
          Animated.spring(starAnims[i], { toValue: 1.4, useNativeDriver: true, tension: 220, friction: 5 }),
          Animated.spring(starAnims[i], { toValue: 1,   useNativeDriver: true, tension: 220, friction: 8 }),
        ]).start();
      } else {
        Animated.spring(starAnims[i], { toValue: 0.85, useNativeDriver: true, tension: 200, friction: 10 })
          .start(() => Animated.spring(starAnims[i], { toValue: 1, useNativeDriver: true, tension: 200, friction: 10 }).start());
      }
    });
  };

  const toggleTag = (id: string) => {
    setTags(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const goHome = () => { clearTrip(); navigation.navigate('Tabs'); };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const selectedTags = TAGS.filter(t => tags.has(t.id)).map(t => t.label);
      const comment = selectedTags.join(', ') || undefined;
      await tripsApi.submitRating({ tripUuid, ratedUserUuid: driverUuid, score, comment });
    } catch {}
    finally { goHome(); }
  };

  const initials = driverName
    ? driverName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : '?';

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: T.bg, opacity: fadeAnim }]}>
      <StatusBar style="light" />

      <Animated.View style={[S.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <ScrollView
            contentContainerStyle={S.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >

            {/* ── Completion check ── */}
            <View style={S.completionRow}>
              <View style={S.checkCircle}>
                <Check size={26} color="#000" strokeWidth={3} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.completionTitle}>¡Llegaste a tu destino!</Text>
                <Text style={S.completionSub}>
                  {fare != null ? `Monto: Bs. ${Math.round(fare)}` : 'Viaje completado'}
                </Text>
              </View>
              {fare != null && (
                <View style={S.fareChip}>
                  <Text style={S.fareChipAmt}>Bs. {Math.round(fare)}</Text>
                  <View style={S.fareChipMethodRow}>
                    {paymentMethod === 'qr'
                      ? <QrCode size={11} color={T.lo} />
                      : <Banknote size={11} color={T.lo} />}
                    <Text style={S.fareChipMethod}>
                      {paymentMethod === 'qr' ? 'QR' : 'Efectivo'}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* ── Driver avatar ── */}
            <View style={S.driverRow}>
              <View style={S.avatar}>
                <Text style={S.avatarText}>{initials}</Text>
              </View>
              <View>
                <Text style={S.driverName}>{driverName ?? 'Tu conductor'}</Text>
                <Text style={S.driverSub}>¿Cómo fue el viaje?</Text>
              </View>
            </View>

            {/* ── Stars ── */}
            <View style={S.starsCard}>
              <View style={S.starsRow}>
                {SCORES.map((s, i) => (
                  <TouchableOpacity key={s} onPress={() => handleStarPress(s)} activeOpacity={0.7}>
                    <Animated.Text
                      style={[
                        S.star,
                        { transform: [{ scale: starAnims[i] }] },
                        s <= score ? S.starOn : S.starOff,
                      ]}
                    >★</Animated.Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={S.scoreLabel}>{SCORE_LABELS[score]}</Text>
            </View>

            {/* ── Tags ── */}
            <View style={S.tagsSection}>
              <Text style={S.tagsSectionTitle}>¿Qué destacarías?</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={S.tagsScroll}
              >
                {TAGS.map(tag => {
                  const on = tags.has(tag.id);
                  return (
                    <TouchableOpacity
                      key={tag.id}
                      style={[S.tagChip, on && S.tagChipOn]}
                      onPress={() => toggleTag(tag.id)}
                      activeOpacity={0.75}
                    >
                      <tag.Icon size={14} color={on ? T.primary : T.lo} strokeWidth={1.5} />
                      <Text style={[S.tagLabel, on && S.tagLabelOn]}>{tag.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* ── Actions ── */}
            <TouchableOpacity
              style={[S.submitBtn, loading && S.btnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={S.submitBtnText}>
                {loading ? 'Enviando...' : 'Enviar calificación'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={S.skipBtn} onPress={goHome} activeOpacity={0.7}>
              <Text style={S.skipBtnText}>Omitir</Text>
            </TouchableOpacity>

          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </Animated.View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: T.bg,
  },
  content: {
    padding: T.lg,
    gap: T.lg,
    paddingBottom: T.lg,
  },

  completionRow: {
    flexDirection: 'row', alignItems: 'center', gap: T.md,
  },
  checkCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: T.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  completionTitle: { fontSize: 20, fontWeight: '800', color: T.hi },
  completionSub:   { fontSize: 13, color: T.mid },
  fareChip: {
    alignItems: 'flex-end',
    backgroundColor: T.card,
    borderRadius: 12, borderWidth: 1, borderColor: T.border,
    paddingHorizontal: T.sm, paddingVertical: 6,
  },
  fareChipAmt:       { fontSize: 16, fontWeight: '800', color: T.accent },
  fareChipMethodRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  fareChipMethod:    { fontSize: 11, color: T.lo },

  driverRow: {
    flexDirection: 'row', alignItems: 'center', gap: T.md,
    backgroundColor: T.surf, borderRadius: 20,
    borderWidth: 1, borderColor: T.border,
    padding: T.md,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: T.primaryDim,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText:  { fontSize: 20, fontWeight: '800', color: T.primary },
  driverName:  { fontSize: 16, fontWeight: '700', color: T.hi },
  driverSub:   { fontSize: 13, color: T.mid, marginTop: 2 },

  starsCard: {
    backgroundColor: T.surf,
    borderRadius: 20, borderWidth: 1, borderColor: T.border,
    padding: T.lg, alignItems: 'center', gap: T.sm,
  },
  starsRow: { flexDirection: 'row', gap: T.sm },
  star:         { fontSize: 46, lineHeight: 52 },
  starOn:       { color: T.warning },
  starOff:      { color: T.border },
  scoreLabel:   { fontSize: 15, fontWeight: '700', color: T.mid },

  tagsSection: { gap: T.sm },
  tagsSectionTitle: {
    fontSize: 11, fontWeight: '700', color: T.lo,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  tagsScroll: { gap: T.xs, paddingBottom: 4 },
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: T.surf, borderRadius: 20,
    borderWidth: 1.5, borderColor: T.border,
    paddingHorizontal: T.sm, paddingVertical: 8,
  },
  tagChipOn:  { borderColor: T.primary, backgroundColor: T.primaryDim },
  tagLabel:   { fontSize: 13, fontWeight: '600', color: T.mid, whiteSpace: 'nowrap' as any },
  tagLabelOn: { color: T.primary },

  submitBtn: {
    backgroundColor: T.primary, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
  },
  btnDisabled:    { opacity: 0.5 },
  submitBtnText:  { fontSize: 16, fontWeight: '700', color: '#fff' },
  skipBtn:        { alignItems: 'center', paddingVertical: T.sm },
  skipBtnText:    { fontSize: 15, fontWeight: '500', color: T.lo },
});
