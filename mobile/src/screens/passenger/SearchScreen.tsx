import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, ActivityIndicator, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft, ArrowRight, X, MapPin, Map } from 'lucide-react-native';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { searchPlaces, getPlaceCoords, reverseGeocode } from '../../services/places';
import type { PlacePrediction } from '../../services/places';
import { registerPickerCallback } from '../../services/locationPicker';
import { Colors }  from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import type { PassengerStackParamList } from '../../navigation/PassengerNavigator';

type Props = NativeStackScreenProps<PassengerStackParamList, 'Search'>;

const T = {
  bg: Colors.bgPrimary, surf: Colors.surface, card: Colors.card,
  border: Colors.border, primary: Colors.primary, primaryDim: Colors.primaryDim,
  hi: Colors.textHigh, mid: Colors.textMid, lo: Colors.textLow,
  accent: Colors.accent, accentDim: Colors.accentDim,
  xs: Spacing.xs, sm: Spacing.sm, md: Spacing.md, lg: Spacing.lg,
} as const;

function shadow() {
  return { shadowColor: '#000' as const, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 8 };
}

interface FieldState {
  text: string;
  lat?: number;
  lng?: number;
  resolved: boolean;
}

const SANTA_CRUZ = { lat: -17.7833, lng: -63.1821 };

export function SearchScreen({ route, navigation }: Props) {
  const { originLat, originLng, originAddress } = route.params;

  const [origin, setOrigin] = useState<FieldState>({
    text: originAddress, lat: originLat, lng: originLng, resolved: true,
  });
  const [dest, setDest]               = useState<FieldState>({ text: '', resolved: false });
  const [activeField, setActiveField] = useState<'origin' | 'dest'>('dest');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching]     = useState(false);
  const [selecting, setSelecting]     = useState(false);
  const [loadingGps, setLoadingGps]   = useState(false);

  const originRef = useRef<TextInput>(null);
  const destRef   = useRef<TextInput>(null);
  const timer     = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTimeout(() => destRef.current?.focus(), 300);
  }, []);

  // ── Text input + autocomplete ──────────────────────────────────────────────

  const activeQuery = activeField === 'origin' ? origin.text : dest.text;

  const onChangeText = useCallback((text: string) => {
    const update: FieldState = { text, resolved: false };
    if (activeField === 'origin') setOrigin(update);
    else setDest(update);

    if (timer.current) clearTimeout(timer.current);
    if (!text.trim()) { setPredictions([]); return; }

    timer.current = setTimeout(async () => {
      setSearching(true);
      const bias = origin.lat && origin.lng ? { lat: origin.lat, lng: origin.lng } : undefined;
      setPredictions(await searchPlaces(text, bias));
      setSearching(false);
    }, 350);
  }, [activeField, origin.lat, origin.lng]);

  // ── Select prediction ──────────────────────────────────────────────────────

  const applyResolved = useCallback((
    field: 'origin' | 'dest',
    lat: number, lng: number, address: string,
  ) => {
    const resolved: FieldState = { text: address, lat, lng, resolved: true };
    if (field === 'origin') {
      setOrigin(resolved);
      setActiveField('dest');
      setPredictions([]);
      setTimeout(() => destRef.current?.focus(), 100);
    } else {
      setDest(resolved);
      setPredictions([]);
    }
  }, []);

  const handleSelect = useCallback(async (p: PlacePrediction) => {
    Keyboard.dismiss();

    if (p.preResolved) {
      const { lat, lng, address } = p.preResolved;
      applyResolved(activeField, lat, lng, address);

      // If destination resolved and origin already resolved → navigate
      if (activeField === 'dest' && origin.resolved && origin.lat && origin.lng) {
        navigation.replace('ConfirmTrip', {
          originLat: origin.lat, originLng: origin.lng, originAddress: origin.text,
          destLat: lat, destLng: lng, destAddress: address,
        });
      }
      return;
    }

    setSelecting(true);
    const coords = await getPlaceCoords(p.placeId);
    setSelecting(false);
    if (!coords) return;

    applyResolved(activeField, coords.lat, coords.lng, coords.address);

    if (activeField === 'dest' && origin.resolved && origin.lat && origin.lng) {
      navigation.replace('ConfirmTrip', {
        originLat: origin.lat, originLng: origin.lng, originAddress: origin.text,
        destLat: coords.lat, destLng: coords.lng, destAddress: coords.address,
      });
    }
  }, [activeField, applyResolved, navigation, origin]);

  // ── GPS ────────────────────────────────────────────────────────────────────

  const handleUseMyLocation = useCallback(async (field: 'origin' | 'dest') => {
    setLoadingGps(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos  = await Location.getCurrentPositionAsync({});
      const addr = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      applyResolved(field, pos.coords.latitude, pos.coords.longitude, addr);
    } finally {
      setLoadingGps(false);
    }
  }, [applyResolved]);

  // ── Map picker ─────────────────────────────────────────────────────────────

  const openMapPicker = useCallback((field: 'origin' | 'dest') => {
    Keyboard.dismiss();
    const current = field === 'origin' ? origin : dest;
    const fallback = field === 'origin'
      ? { lat: originLat, lng: originLng }
      : { lat: origin.lat ?? SANTA_CRUZ.lat, lng: origin.lng ?? SANTA_CRUZ.lng };

    registerPickerCallback(({ lat, lng, address }) => {
      applyResolved(field, lat, lng, address);
    });

    navigation.navigate('MapPicker', {
      field,
      initialLat: current.lat ?? fallback.lat,
      initialLng: current.lng ?? fallback.lng,
    });
  }, [navigation, origin, dest, originLat, originLng, applyResolved]);

  // ── Confirm (when both resolved) ───────────────────────────────────────────

  const canConfirm = origin.resolved && dest.resolved &&
    origin.lat != null && origin.lng != null &&
    dest.lat   != null && dest.lng   != null;

  const handleConfirm = useCallback(() => {
    if (!canConfirm) return;
    navigation.replace('ConfirmTrip', {
      originLat: origin.lat!, originLng: origin.lng!, originAddress: origin.text,
      destLat:   dest.lat!,   destLng:   dest.lng!,   destAddress:   dest.text,
    });
  }, [canConfirm, navigation, origin, dest]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={S.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity style={S.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={22} color={T.hi} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={S.headerTitle}>Nuevo viaje</Text>
        {canConfirm ? (
          <TouchableOpacity style={S.confirmBtnSmall} onPress={handleConfirm}>
            <View style={S.confirmBtnSmallInner}>
              <Text style={S.confirmBtnSmallText}>Ir</Text>
              <ArrowRight size={14} color="#FFF" strokeWidth={2.5} />
            </View>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 52 }} />
        )}
      </View>

      {/* Route input card */}
      <View style={[S.inputCard, shadow()]}>

        {/* ── Origin ── */}
        <TouchableOpacity
          style={[S.inputRow, activeField === 'origin' && S.inputRowActive]}
          onPress={() => { setActiveField('origin'); originRef.current?.focus(); }}
          activeOpacity={1}
        >
          <View style={S.dotWrap}><View style={[S.dot, { backgroundColor: T.accent }]} /></View>
          <View style={S.inputLabelWrap}>
            <Text style={S.inputLabel}>ORIGEN</Text>
            <TextInput
              ref={originRef}
              style={S.textInput}
              placeholder="¿Desde dónde salís?"
              placeholderTextColor={T.lo}
              value={origin.text}
              onChangeText={onChangeText}
              onFocus={() => { setActiveField('origin'); setPredictions([]); }}
              returnKeyType="next"
              autoCorrect={false}
            />
          </View>
          {origin.resolved && (
            <TouchableOpacity onPress={() => { setOrigin({ text: '', resolved: false }); originRef.current?.focus(); }} hitSlop={8}>
              <X size={14} color={T.lo} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* Separator */}
        <View style={S.dividerRow}>
          <View style={S.dotWrap}><View style={S.dashedLine} /></View>
          <View style={{ flex: 1, height: 1, backgroundColor: T.border }} />
        </View>

        {/* ── Destination ── */}
        <TouchableOpacity
          style={[S.inputRow, activeField === 'dest' && S.inputRowActive]}
          onPress={() => { setActiveField('dest'); destRef.current?.focus(); }}
          activeOpacity={1}
        >
          <View style={S.dotWrap}><View style={[S.dot, { backgroundColor: T.primary }]} /></View>
          <View style={S.inputLabelWrap}>
            <Text style={S.inputLabel}>DESTINO</Text>
            <TextInput
              ref={destRef}
              style={S.textInput}
              placeholder="¿A dónde vas?"
              placeholderTextColor={T.lo}
              value={dest.text}
              onChangeText={onChangeText}
              onFocus={() => { setActiveField('dest'); setPredictions([]); }}
              returnKeyType="search"
              autoCorrect={false}
            />
          </View>
          {dest.resolved && (
            <TouchableOpacity onPress={() => { setDest({ text: '', resolved: false }); destRef.current?.focus(); }} hitSlop={8}>
              <X size={14} color={T.lo} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </View>

      {/* Quick action buttons — always visible, both options for both fields */}
      <View style={S.quickActions}>
        <TouchableOpacity
          style={[S.actionBtn, loadingGps && S.actionBtnDisabled]}
          onPress={() => handleUseMyLocation(activeField)}
          disabled={loadingGps}
          activeOpacity={0.75}
        >
          {loadingGps
            ? <ActivityIndicator color={T.accent} size="small" />
            : <MapPin size={20} color={T.accent} strokeWidth={1.5} />}
          <View>
            <Text style={S.actionLabel}>Mi ubicación</Text>
            <Text style={S.actionSub}>GPS automático</Text>
          </View>
        </TouchableOpacity>

        <View style={S.actionDivider} />

        <TouchableOpacity
          style={S.actionBtn}
          onPress={() => openMapPicker(activeField)}
          activeOpacity={0.75}
        >
          <Map size={20} color={T.primary} strokeWidth={1.5} />
          <View>
            <Text style={S.actionLabel}>Elegir en el mapa</Text>
            <Text style={S.actionSub}>Arrastrar pin</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Field context hint */}
      <View style={S.contextHint}>
        <View style={[S.contextDot, { backgroundColor: activeField === 'origin' ? T.accent : T.primary }]} />
        <Text style={S.contextText}>
          Eligiendo para: <Text style={S.contextBold}>{activeField === 'origin' ? 'Origen' : 'Destino'}</Text>
        </Text>
      </View>

      {/* Status */}
      {(searching || selecting) && (
        <View style={S.statusRow}>
          <ActivityIndicator color={T.primary} size="small" />
          <Text style={S.statusText}>{selecting ? 'Obteniendo ubicación…' : 'Buscando…'}</Text>
        </View>
      )}

      {/* Autocomplete results */}
      <FlatList
        data={predictions}
        keyExtractor={item => item.placeId}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={S.listContent}
        ItemSeparatorComponent={() => <View style={S.separator} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={S.resultItem} onPress={() => handleSelect(item)} activeOpacity={0.7}>
            <View style={S.placeIconWrap}>
              <MapPin size={16} color={T.lo} strokeWidth={1.5} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.placeMain} numberOfLines={1}>{item.mainText}</Text>
              <Text style={S.placeSub}  numberOfLines={1}>{item.secondaryText}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !searching && activeQuery.trim().length > 1 && predictions.length === 0 ? (
            <View style={S.emptyWrap}>
              <Text style={S.emptyText}>Sin resultados para "{activeQuery}"</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: T.md, paddingVertical: T.sm,
  },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: T.hi },
  confirmBtnSmall: {
    backgroundColor: T.primary, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  confirmBtnSmallInner: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  confirmBtnSmallText:  { fontSize: 13, fontWeight: '700', color: '#FFF' },

  inputCard: {
    marginHorizontal: T.md, marginBottom: T.sm,
    backgroundColor: T.card, borderRadius: 16,
    borderWidth: 1, borderColor: T.border,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: T.sm, paddingHorizontal: T.md, paddingVertical: T.sm + 2,
    borderRadius: 16,
  },
  inputRowActive: { backgroundColor: T.surf },
  dotWrap: { width: 20, alignItems: 'center' },
  dot:     { width: 10, height: 10, borderRadius: 5 },
  dashedLine: {
    width: 2, height: 18,
    borderStyle: 'dashed', borderWidth: 1, borderColor: T.border,
  },
  dividerRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: T.sm, paddingLeft: T.md,
  },
  inputLabelWrap: { flex: 1, paddingVertical: 2 },
  inputLabel: {
    fontSize: 10, fontWeight: '600', color: T.lo,
    letterSpacing: 0.8, marginBottom: 2,
  },
  textInput: { fontSize: 14, color: T.hi, paddingVertical: 0 },

  // Quick actions
  quickActions: {
    flexDirection:    'row',
    marginHorizontal: T.md,
    marginBottom:     T.xs,
    backgroundColor:  T.card,
    borderRadius:     14,
    borderWidth:      1,
    borderColor:      T.border,
    overflow:         'hidden',
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    gap: T.sm, padding: T.sm + 2,
  },
  actionBtnDisabled: { opacity: 0.5 },
  actionLabel: { fontSize: 13, fontWeight: '600', color: T.hi },
  actionSub:   { fontSize: 11, color: T.lo },
  actionDivider: { width: 1, backgroundColor: T.border, marginVertical: T.sm },

  // Context hint
  contextHint: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    marginHorizontal:  T.md,
    marginBottom:      T.xs,
  },
  contextDot:  { width: 7, height: 7, borderRadius: 3.5 },
  contextText: { fontSize: 12, color: T.lo },
  contextBold: { fontWeight: '700', color: T.mid },

  statusRow: {
    flexDirection: 'row', alignItems: 'center', gap: T.xs,
    paddingHorizontal: T.md, paddingVertical: T.xs,
  },
  statusText: { fontSize: 13, color: T.lo },

  listContent: { paddingBottom: T.lg },
  separator:   { height: 1, backgroundColor: T.border, marginLeft: T.md + 20 + T.sm },
  resultItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: T.md, paddingVertical: T.md, gap: T.sm,
  },
  placeIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: T.surf, alignItems: 'center', justifyContent: 'center',
  },
  placeMain: { fontSize: 14, fontWeight: '600', color: T.hi, marginBottom: 2 },
  placeSub:  { fontSize: 12, color: T.lo },
  emptyWrap: { paddingHorizontal: T.md, paddingTop: T.lg, alignItems: 'center' },
  emptyText: { fontSize: 14, color: T.lo },
});
