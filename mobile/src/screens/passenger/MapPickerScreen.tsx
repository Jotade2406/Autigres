import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Dimensions,
} from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { reverseGeocode } from '../../services/places';
import { resolvePickerCallback } from '../../services/locationPicker';
import { Colors }  from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import type { PassengerStackParamList } from '../../navigation/PassengerNavigator';

type Props = NativeStackScreenProps<PassengerStackParamList, 'MapPicker'>;

const T = {
  bg: Colors.bgPrimary, card: Colors.card, surf: Colors.surface,
  border: Colors.border, primary: Colors.primary, primaryDim: Colors.primaryDim,
  accent: Colors.accent, hi: Colors.textHigh, mid: Colors.textMid, lo: Colors.textLow,
  xs: Spacing.xs, sm: Spacing.sm, md: Spacing.md, lg: Spacing.lg,
} as const;

function shadow(e = 8) {
  return { shadowColor: '#000' as const, shadowOffset: { width: 0, height: e / 2 }, shadowOpacity: 0.28, shadowRadius: e, elevation: e };
}

const darkStyle = [
  { elementType: 'geometry',           stylers: [{ color: '#09090F' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#8B8BA0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#09090F' }] },
  { featureType: 'road',         elementType: 'geometry', stylers: [{ color: '#1C1C28' }] },
  { featureType: 'road.arterial',elementType: 'geometry', stylers: [{ color: '#272737' }] },
  { featureType: 'water',        elementType: 'geometry', stylers: [{ color: '#13131C' }] },
];

const { height: SCREEN_H } = Dimensions.get('window');

export function MapPickerScreen({ route, navigation }: Props) {
  const { field, initialLat, initialLng } = route.params;
  const insets = useSafeAreaInsets();

  const isOrigin = field === 'origin';
  const label    = isOrigin ? 'Elegir origen' : 'Elegir destino';
  const dotColor = isOrigin ? T.accent : T.primary;

  const [address, setAddress]   = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [dragging, setDragging]   = useState(false);
  const centerRef = useRef({ lat: initialLat, lng: initialLng });
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initialRegion: Region = {
    latitude:       initialLat,
    longitude:      initialLng,
    latitudeDelta:  0.01,
    longitudeDelta: 0.01,
  };

  const onRegionChangeComplete = useCallback((region: Region) => {
    setDragging(false);
    centerRef.current = { lat: region.latitude, lng: region.longitude };

    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    setGeocoding(true);
    setAddress('');

    geocodeTimer.current = setTimeout(async () => {
      const addr = await reverseGeocode(region.latitude, region.longitude);
      setAddress(addr);
      setGeocoding(false);
    }, 500);
  }, []);

  const onRegionChange = useCallback(() => {
    setDragging(true);
    setAddress('');
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!address || geocoding) return;
    resolvePickerCallback({ lat: centerRef.current.lat, lng: centerRef.current.lng, address });
    navigation.goBack();
  }, [address, geocoding, navigation]);

  return (
    <View style={S.root}>
      <StatusBar style="light" />

      {/* Map */}
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        customMapStyle={darkStyle}
        showsUserLocation
        showsMyLocationButton={false}
        onRegionChange={onRegionChange}
        onRegionChangeComplete={onRegionChangeComplete}
      />

      {/* Top bar */}
      <View style={[S.topBar, { paddingTop: insets.top + T.xs }]}>
        <TouchableOpacity style={[S.backPill, shadow(6)]} onPress={() => navigation.goBack()} hitSlop={8}>
          <ChevronLeft size={18} color={T.hi} strokeWidth={2} />
          <Text style={S.backLabel}>{label}</Text>
        </TouchableOpacity>
      </View>

      {/* Crosshair pin — tip is at exact map center */}
      <View style={S.pinWrap} pointerEvents="none">
        <View style={S.pinBody}>
          <View style={[S.pinCircle, { borderColor: dotColor, backgroundColor: T.bg }]}>
            <View style={[S.pinDot, { backgroundColor: dotColor }]} />
          </View>
          <View style={[S.pinStem, { backgroundColor: dotColor }]} />
        </View>
        {/* Shadow dot at tip */}
        <View style={S.pinShadowDot} />
      </View>

      {/* Hint label while dragging */}
      {dragging && (
        <View style={[S.hintPill, shadow(4), { bottom: SCREEN_H * 0.28 + 12 }]}>
          <Text style={S.hintText}>Arrastrá el mapa para elegir</Text>
        </View>
      )}

      {/* Bottom card */}
      <View style={[S.bottomCard, shadow(12), { paddingBottom: insets.bottom + T.md }]}>

        <View style={S.addrRow}>
          <View style={[S.addrDot, { backgroundColor: dotColor }]} />
          <View style={{ flex: 1 }}>
            <Text style={S.addrLabel}>{isOrigin ? 'ORIGEN' : 'DESTINO'}</Text>
            {geocoding || dragging ? (
              <View style={S.addrLoadRow}>
                <ActivityIndicator color={T.lo} size="small" />
                <Text style={S.addrLoading}>Obteniendo dirección…</Text>
              </View>
            ) : (
              <Text style={S.addrText} numberOfLines={2}>
                {address || 'Mueve el mapa para seleccionar'}
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[
            S.confirmBtn,
            { backgroundColor: dotColor },
            (!address || geocoding || dragging) && S.btnDisabled,
          ]}
          onPress={handleConfirm}
          disabled={!address || geocoding || dragging}
          activeOpacity={0.85}
        >
          <Text style={S.confirmText}>Confirmar ubicación</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },

  // Top bar
  topBar: {
    position:          'absolute',
    top:               0, left: 0, right: 0,
    paddingHorizontal: T.md,
    paddingBottom:     T.sm,
  },
  backPill: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              T.sm,
    alignSelf:        'flex-start',
    backgroundColor:  T.card,
    borderRadius:     24,
    borderWidth:      1,
    borderColor:      T.border,
    paddingHorizontal:T.md,
    paddingVertical:  9,
  },
  backLabel: { fontSize: 14, fontWeight: '700', color: T.hi },

  // Pin
  pinWrap: {
    position:  'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    // The pin body's tip is at center, so offset the wrap upward by half pin height
  },
  pinBody: { alignItems: 'center', marginBottom: 6 },
  pinCircle: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center',
  },
  pinDot:  { width: 10, height: 10, borderRadius: 5 },
  pinStem: { width: 2.5, height: 18, borderRadius: 2 },
  pinShadowDot: {
    width: 8, height: 4, borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },

  // Hint
  hintPill: {
    position:         'absolute',
    alignSelf:        'center',
    backgroundColor:  T.card,
    borderRadius:     20,
    borderWidth:      1,
    borderColor:      T.border,
    paddingHorizontal:T.md,
    paddingVertical:  7,
  },
  hintText: { fontSize: 13, color: T.mid },

  // Bottom card
  bottomCard: {
    position:             'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor:      T.card,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    borderWidth:          1,
    borderColor:          T.border,
    paddingHorizontal:    T.md,
    paddingTop:           T.md,
    gap:                  T.md,
  },
  addrRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: T.sm,
  },
  addrDot:    { width: 12, height: 12, borderRadius: 6, marginTop: 14 },
  addrLabel:  { fontSize: 10, fontWeight: '700', color: T.lo, letterSpacing: 0.8, marginBottom: 3 },
  addrLoadRow:{ flexDirection: 'row', alignItems: 'center', gap: 6 },
  addrLoading:{ fontSize: 13, color: T.lo },
  addrText:   { fontSize: 14, color: T.hi, lineHeight: 20 },

  confirmBtn: {
    borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled:  { opacity: 0.45 },
  confirmText:  { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
