import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar }   from 'expo-status-bar';
import * as Location   from 'expo-location';
import type { LatLng } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MapPin, ArrowLeftRight, ArrowRight, Plane } from 'lucide-react-native';
import { AuMap }        from '../../components/map/AuMap';
import { useTripStore } from '../../store/trip.store';
import { useAuthStore } from '../../store/auth.store';
import { reverseGeocode } from '../../services/places';
import { Colors }  from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import type { PassengerStackParamList } from '../../navigation/PassengerNavigator';

type Nav = NativeStackNavigationProp<PassengerStackParamList>;

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
  hi:         Colors.textHigh,
  mid:        Colors.textMid,
  lo:         Colors.textLow,
  xs: Spacing.xs,
  sm: Spacing.sm,
  md: Spacing.md,
  lg: Spacing.lg,
  xl: Spacing.xl,
} as const;

function shadow(size: 'sm' | 'md' | 'lg' = 'md') {
  const cfg = { sm: { e: 4, r: 4, o: 0.20 }, md: { e: 8, r: 8, o: 0.25 }, lg: { e: 16, r: 12, o: 0.35 } }[size];
  return { shadowColor: '#000' as const, shadowOffset: { width: 0, height: cfg.e / 2 }, shadowOpacity: cfg.o, shadowRadius: cfg.r, elevation: cfg.e };
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function HomeScreen() {
  const navigation  = useNavigation<Nav>();
  const { user }    = useAuthStore();
  const { activeTrip } = useTripStore();

  const insets = useSafeAreaInsets();

  const SANTA_CRUZ_CENTER: LatLng = { latitude: -17.7833, longitude: -63.1821 };

  const [userLocation, setUserLocation]   = useState<LatLng>(SANTA_CRUZ_CENTER);
  const [originAddress, setOriginAddress] = useState('Santa Cruz de la Sierra');
  const [locLoading, setLocLoading]       = useState(true);

  // ── Location + reverse geocode ────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { setLocLoading(false); return; }

        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const loc: LatLng = {
          latitude:  pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setUserLocation(loc);

        const addr = await reverseGeocode(loc.latitude, loc.longitude);
        setOriginAddress(addr);
      } catch {
        // GPS unavailable (emulator) — keep Santa Cruz center as origin
      } finally {
        setLocLoading(false);
      }
    })();
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const firstName = user?.fullName?.split(' ')[0] ?? 'viajero';
  const initials  = user?.fullName
    ? user.fullName.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : '?';

  const handleSearchPress = () => {
    navigation.navigate('Search', {
      originLat:     userLocation.latitude,
      originLng:     userLocation.longitude,
      originAddress,
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={S.root}>
      <StatusBar style="light" />

      {/* ── Fullscreen map ── */}
      <AuMap
        userLocation={userLocation}
        waypoints={activeTrip?.route ?? []}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Top floating header ── */}
      <View style={[S.topBar, { paddingTop: insets.top + T.sm }]}>
        {/* Logo */}
        <View style={[S.logoWrap, shadow('sm')]}>
          <Text style={S.logoText}>AUTIGRES</Text>
        </View>

        {/* Avatar */}
        <TouchableOpacity style={[S.avatar, shadow('sm')]} activeOpacity={0.8}>
          <Text style={S.avatarText}>{initials}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Bottom sheet ── */}
      <View style={[S.sheet, shadow('lg'), { paddingBottom: insets.bottom + T.md }]}>

        {/* Greeting */}
        <View style={S.greetRow}>
          <View>
            <Text style={S.greetHi}>Hola, {firstName}</Text>
            <Text style={S.greetSub}>¿A dónde vamos hoy?</Text>
          </View>
          <View style={S.poolBadge}>
            <ArrowLeftRight size={11} color={T.accent} />
            <Text style={S.poolText}>Viaje compartido</Text>
          </View>
        </View>

        {/* Search button */}
        <TouchableOpacity
          style={[S.searchBtn, shadow('sm')]}
          onPress={handleSearchPress}
          activeOpacity={0.85}
        >
          <View style={S.searchIconWrap}>
            <MapPin size={18} color={T.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.searchPlaceholder}>¿A dónde vas?</Text>
            <Text style={S.searchOrigin} numberOfLines={1}>{originAddress}</Text>
          </View>
          <View style={S.searchArrow}>
            <ArrowRight size={16} color='#FFF' />
          </View>
        </TouchableOpacity>

        {/* Quick destinations */}
        <Text style={S.sectionLabel}>Destinos frecuentes</Text>
        <View style={S.quickRow}>
          {QUICK_DESTS.map(q => (
            <TouchableOpacity
              key={q.label}
              style={S.quickChip}
              activeOpacity={0.75}
              onPress={() => {
                navigation.navigate('ConfirmTrip', {
                  originLat:     userLocation.latitude,
                  originLng:     userLocation.longitude,
                  originAddress,
                  destLat:     q.lat,
                  destLng:     q.lng,
                  destAddress: q.label,
                });
              }}
            >
              <q.Icon size={20} color={T.mid} />
              <Text style={S.quickLabel}>{q.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

      </View>
    </View>
  );
}

// ── Quick destinations (Santa Cruz de la Sierra) ──────────────────────────────

const QUICK_DESTS = [
  { label: 'Plaza 24 de Septiembre', Icon: MapPin, lat: -17.7840, lng: -63.1821 },
  { label: 'Aeropuerto Viru Viru',   Icon: Plane,  lat: -17.6448, lng: -63.1357 },
  { label: 'Hospital Japonés',       Icon: MapPin, lat: -17.7686, lng: -63.1472 },
];

// ── Styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },

  // Top bar
  topBar: {
    position:          'absolute',
    top:               0,
    left:              0,
    right:             0,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: T.md,
  },
  logoWrap: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              6,
    backgroundColor:  T.card,
    borderRadius:     20,
    borderWidth:      1,
    borderColor:      T.border,
    paddingHorizontal:12,
    paddingVertical:  7,
  },
  logoText:  {
    fontSize:    16,
    fontWeight:  '800',
    color:       T.primary,
    letterSpacing: 1.2,
  },
  avatar: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: T.primaryDim,
    borderWidth:     1.5,
    borderColor:     T.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: T.primary },

  // Bottom sheet
  sheet: {
    position:             'absolute',
    bottom:               0,
    left:                 0,
    right:                0,
    backgroundColor:      T.card,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    borderWidth:          1,
    borderColor:          T.border,
    paddingHorizontal:    T.md,
    paddingTop:           T.md,
    gap:                  T.md,
  },

  // Greeting
  greetRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  greetHi:  { fontSize: 20, fontWeight: '700', color: T.hi, marginBottom: 2 },
  greetSub: { fontSize: 13, color: T.lo },
  poolBadge: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              4,
    backgroundColor:  T.accentDim,
    borderRadius:     20,
    paddingHorizontal:10,
    paddingVertical:  5,
    borderWidth:      1,
    borderColor:      T.accent,
  },
  poolText: { fontSize: 11, fontWeight: '600', color: T.accent },

  // Search button
  searchBtn: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              T.sm,
    backgroundColor:  T.surf,
    borderRadius:     16,
    borderWidth:      1,
    borderColor:      T.border,
    paddingHorizontal:T.md,
    paddingVertical:  T.sm + 2,
  },
  searchIconWrap: {
    width:           36,
    height:          36,
    borderRadius:    10,
    backgroundColor: T.primaryDim,
    alignItems:      'center',
    justifyContent:  'center',
  },
  searchPlaceholder: { fontSize: 15, fontWeight: '600', color: T.hi, marginBottom: 2 },
  searchOrigin:      { fontSize: 12, color: T.lo },
  searchArrow: {
    width:           32,
    height:          32,
    borderRadius:    8,
    backgroundColor: T.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },

  // Quick destinations
  sectionLabel: {
    fontSize: 12, fontWeight: '600', color: T.lo,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: -T.xs,
  },
  quickRow: { flexDirection: 'row', gap: T.sm },
  quickChip: {
    flex:             1,
    alignItems:       'center',
    gap:              4,
    backgroundColor:  T.surf,
    borderRadius:     12,
    borderWidth:      1,
    borderColor:      T.border,
    paddingVertical:  T.sm,
  },
  quickLabel: { fontSize: 10, fontWeight: '600', color: T.mid, textAlign: 'center' },
});
