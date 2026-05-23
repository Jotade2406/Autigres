import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }     from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Car, User, Mail, Phone, MapPin, Users, Pencil, Trash2 } from 'lucide-react-native';
import { usersApi }   from '../api/users.api';
import { driversApi } from '../api/drivers.api';
import { useAuthStore } from '../store/auth.store';
import { Colors }       from '../theme/colors';
import { Spacing }      from '../theme/spacing';
import type { UserProfileDto, VehicleDto } from '../api/types';

// ── Design tokens ─────────────────────────────────────────────────────────────

const C = Colors;

function shadow() {
  return {
    shadowColor: '#000' as const,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StarRating({ rating, count }: { rating: number; count: number }) {
  const full = Math.round(rating);
  return (
    <View style={S.starWrap}>
      <View style={S.starRow}>
        {[1, 2, 3, 4, 5].map(i => (
          <Text key={i} style={[S.star, i <= full && S.starFull]}>★</Text>
        ))}
      </View>
      <Text style={S.ratingText}>
        {rating.toFixed(1)} <Text style={S.ratingCount}>({count} viajes)</Text>
      </Text>
    </View>
  );
}

function InfoRow({
  icon, label, value,
}: { icon: React.ReactElement; label: string; value: string }) {
  return (
    <View style={S.infoRow}>
      <View style={S.infoIconWrap}>
        {icon}
      </View>
      <View style={S.infoBody}>
        <Text style={S.infoLabel}>{label}</Text>
        <Text style={S.infoValue} numberOfLines={1}>{value || '—'}</Text>
      </View>
    </View>
  );
}

// ── Vehicle card (driver has one) ─────────────────────────────────────────────

function VehicleCard({
  vehicle,
  onEdit,
  onDelete,
}: {
  vehicle: VehicleDto;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={[S.vehicleCard, shadow()]}>
      <View style={S.vehicleHeader}>
        <Car size={28} color={C.textMid} />
        <View style={{ flex: 1 }}>
          <Text style={S.vehicleTitle}>{vehicle.brand} {vehicle.model}</Text>
          <Text style={S.vehicleYear}>{vehicle.year} · {vehicle.color}</Text>
        </View>
        <View style={[S.vehicleStatusBadge, vehicle.isActive && S.vehicleStatusActive]}>
          <Text style={[S.vehicleStatusText, vehicle.isActive && S.vehicleStatusTextActive]}>
            {vehicle.isActive ? 'Activo' : 'Inactivo'}
          </Text>
        </View>
      </View>

      <View style={S.vehiclePlateLarge}>
        <Text style={S.vehiclePlateNumber}>{vehicle.plateNumber}</Text>
        <Text style={S.vehiclePlateLabel}>Placa</Text>
      </View>

      <View style={S.vehicleCapRow}>
        <View style={S.vehicleCapInner}>
          <Users size={13} color={C.textMid} />
          <Text style={S.vehicleCapText}>Capacidad: {vehicle.capacity} pasajeros</Text>
        </View>
      </View>

      <View style={S.vehicleActions}>
        <TouchableOpacity style={S.vehicleEditBtn} onPress={onEdit} activeOpacity={0.8}>
          <View style={S.vehicleEditInner}>
            <Pencil size={14} color={C.primary} />
            <Text style={S.vehicleEditText}>Editar vehículo</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={S.vehicleDeleteBtn} onPress={onDelete} activeOpacity={0.8}>
          <Trash2 size={18} color={C.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function ProfileScreen() {
  const { user, logout }          = useAuthStore();
  const navigation                = useNavigation<any>();
  const [profile,  setProfile]    = useState<UserProfileDto | null>(null);
  const [vehicle,  setVehicle]    = useState<VehicleDto | null | undefined>(undefined);
  const [loading,  setLoading]    = useState(true);
  const [deleting, setDeleting]   = useState(false);

  const isDriver = (profile?.role ?? user?.role) === 'driver';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const p = await usersApi.getProfile();
      setProfile(p);
      if (p.role === 'driver') {
        const v = await driversApi.getVehicle();
        setVehicle(v);
      } else {
        setVehicle(null);
      }
    } catch {
      // silent — auth errors handled at navigator level
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload profile whenever screen comes back into focus (e.g. after editing vehicle)
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleEditVehicle = () => {
    if (!vehicle) return;
    navigation.navigate('RegisterVehicle', {
      vehicleId:   vehicle.id,
      plateNumber: vehicle.plateNumber,
      brand:       vehicle.brand,
      model:       vehicle.model,
      year:        String(vehicle.year),
      color:       vehicle.color,
      capacity:    String(vehicle.capacity),
    });
  };

  const handleDeleteVehicle = () => {
    if (!vehicle) return;
    Alert.alert(
      'Eliminar vehículo',
      `¿Confirmás que querés eliminar la ${vehicle.brand} ${vehicle.model} (${vehicle.plateNumber})?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await driversApi.deleteVehicle(vehicle.id);
              setVehicle(null);
            } catch {
              Alert.alert('Error', 'No se pudo eliminar el vehículo.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const initials = (profile?.fullName ?? user?.fullName ?? '?')
    .trim().split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={S.safe}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={S.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero header ── */}
        <View style={[S.heroCard, shadow()]}>
          {/* Avatar */}
          <View style={S.avatarRing}>
            <View style={S.avatar}>
              <Text style={S.avatarText}>{initials}</Text>
            </View>
          </View>

          {/* Name + role */}
          <Text style={S.heroName}>{profile?.fullName ?? user?.fullName ?? '—'}</Text>
          <View style={S.rolePill}>
            {isDriver ? <Car size={14} color={C.textMid} /> : <User size={14} color={C.textMid} />}
            <Text style={S.rolePillText}>
              {isDriver ? 'Conductor' : 'Pasajero'}
            </Text>
          </View>

          {/* Rating */}
          {profile && (
            <StarRating rating={profile.ratingAverage} count={profile.totalTrips} />
          )}
          {loading && !profile && (
            <ActivityIndicator color={C.primary} style={{ marginTop: 8 }} />
          )}
        </View>

        {/* ── Info card ── */}
        {profile && (
          <View style={[S.infoCard, shadow()]}>
            <InfoRow icon={<User    size={18} color={C.textMid} />} label="Nombre completo"      value={profile.fullName} />
            <View style={S.divider} />
            <InfoRow icon={<Mail    size={18} color={C.textMid} />} label="Correo electrónico"   value={profile.email} />
            <View style={S.divider} />
            <InfoRow icon={<Phone   size={18} color={C.textMid} />} label="Teléfono"             value={profile.phone} />
            <View style={S.divider} />
            <InfoRow icon={<MapPin  size={18} color={C.textMid} />} label="Total de viajes"      value={`${profile.totalTrips} viajes realizados`} />
          </View>
        )}

        {/* ── Vehicle section (driver only) ── */}
        {isDriver && !loading && (
          <>
            <View style={S.sectionHeader}>
              <Text style={S.sectionTitle}>Mi vehículo</Text>
            </View>

            {vehicle === undefined ? (
              // still loading vehicle
              <ActivityIndicator color={C.primary} />
            ) : vehicle ? (
              // Has a vehicle → show card
              <VehicleCard
                vehicle={vehicle}
                onEdit={handleEditVehicle}
                onDelete={handleDeleteVehicle}
              />
            ) : (
              // No vehicle → show register button
              <TouchableOpacity
                style={[S.registerVehicleBtn, shadow()]}
                onPress={() => navigation.navigate('RegisterVehicle')}
                activeOpacity={0.8}
              >
                <View style={S.registerVehicleLeft}>
                  <View style={S.registerVehicleIconWrap}>
                    <Car size={22} color={C.primary} />
                  </View>
                  <View>
                    <Text style={S.registerVehicleTitle}>Registrar vehículo</Text>
                    <Text style={S.registerVehicleSub}>Requerido para aceptar viajes</Text>
                  </View>
                </View>
                <Text style={S.registerVehicleArrow}>›</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Deleting overlay */}
        {deleting && (
          <View style={S.deletingRow}>
            <ActivityIndicator color={C.error} size="small" />
            <Text style={S.deletingText}>Eliminando vehículo...</Text>
          </View>
        )}

        {/* ── Logout ── */}
        <TouchableOpacity style={S.logoutBtn} onPress={logout} activeOpacity={0.8}>
          <Text style={S.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bgPrimary },
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 80 },

  // Hero card
  heroCard: {
    backgroundColor: C.surface,
    borderRadius:    24,
    borderWidth:     1,
    borderColor:     C.border,
    padding:         Spacing.lg,
    alignItems:      'center',
    gap:             Spacing.sm,
  },
  avatarRing: {
    width: 92, height: 92, borderRadius: 46,
    borderWidth: 3, borderColor: C.primary,
    padding: 3,
    marginBottom: Spacing.xs,
  },
  avatar: {
    flex: 1, borderRadius: 43,
    backgroundColor: C.primaryDim,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 30, fontWeight: '800', color: C.primary },
  heroName:   { fontSize: 22, fontWeight: '700', color: C.textHigh, textAlign: 'center' },
  rolePill: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              6,
    backgroundColor:  C.card,
    borderRadius:     20,
    borderWidth:      1,
    borderColor:      C.border,
    paddingHorizontal:14,
    paddingVertical:  5,
  },
  rolePillText: { fontSize: 13, fontWeight: '600', color: C.textMid },

  // Stars
  starWrap: { alignItems: 'center', gap: 3, marginTop: Spacing.xs },
  starRow:  { flexDirection: 'row', gap: 3 },
  star:     { fontSize: 18, color: C.border },
  starFull: { color: C.warning },
  ratingText:  { fontSize: 15, fontWeight: '700', color: C.textHigh },
  ratingCount: { fontSize: 13, fontWeight: '400', color: C.textLow },

  // Info card
  infoCard: {
    backgroundColor: C.surface,
    borderRadius:    20,
    borderWidth:     1,
    borderColor:     C.border,
    overflow:        'hidden',
  },
  infoRow:     { flexDirection: 'row', alignItems: 'center', gap: 14, padding: Spacing.md },
  infoIconWrap:{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  infoBody:    { flex: 1 },
  infoLabel:   { fontSize: 11, fontWeight: '600', color: C.textLow, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 2 },
  infoValue:   { fontSize: 15, fontWeight: '500', color: C.textHigh },
  divider:     { height: 1, backgroundColor: C.border, marginLeft: Spacing.md + 36 + 14 },

  // Section header
  sectionHeader: { paddingTop: Spacing.sm },
  sectionTitle:  { fontSize: 13, fontWeight: '700', color: C.textLow, textTransform: 'uppercase', letterSpacing: 0.8 },

  // Vehicle card
  vehicleCard: {
    backgroundColor: C.surface,
    borderRadius:    20,
    borderWidth:     1,
    borderColor:     C.border,
    padding:         Spacing.md,
    gap:             Spacing.sm,
  },
  vehicleHeader:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vehicleTitle:     { fontSize: 17, fontWeight: '700', color: C.textHigh },
  vehicleYear:      { fontSize: 13, color: C.textLow, marginTop: 2 },
  vehicleStatusBadge: {
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: C.errorDim, borderWidth: 1, borderColor: C.error,
  },
  vehicleStatusActive: { backgroundColor: C.accentDim, borderColor: C.accent },
  vehicleStatusText:   { fontSize: 11, fontWeight: '700', color: C.error },
  vehicleStatusTextActive: { color: C.accent },

  vehiclePlateLarge: {
    backgroundColor: C.card,
    borderRadius:    16,
    borderWidth:     2,
    borderColor:     C.primary,
    paddingVertical: 16,
    alignItems:      'center',
    gap:             2,
  },
  vehiclePlateNumber: { fontSize: 36, fontWeight: '900', color: C.textHigh, letterSpacing: 6, fontVariant: ['tabular-nums'] as any },
  vehiclePlateLabel:  { fontSize: 10, fontWeight: '700', color: C.textLow, textTransform: 'uppercase', letterSpacing: 1 },

  vehicleCapRow:    { alignItems: 'center' },
  vehicleCapInner:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  vehicleCapText:   { fontSize: 13, color: C.textMid },

  vehicleActions: { flexDirection: 'row', gap: Spacing.sm },
  vehicleEditBtn: {
    flex: 1,
    backgroundColor: C.primaryDim,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     C.primary,
    paddingVertical: 12,
    alignItems:      'center',
  },
  vehicleEditInner:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  vehicleEditText:   { fontSize: 14, fontWeight: '600', color: C.primary },
  vehicleDeleteBtn: {
    backgroundColor: C.errorDim,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     C.error,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems:      'center',
    justifyContent:  'center',
  },

  // Register vehicle button (empty state)
  registerVehicleBtn: {
    backgroundColor: C.surface,
    borderRadius:    20,
    borderWidth:     1,
    borderColor:     C.border,
    padding:         Spacing.md,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             Spacing.sm,
  },
  registerVehicleLeft:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  registerVehicleIconWrap:{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.primaryDim, alignItems: 'center', justifyContent: 'center' },
  registerVehicleTitle:   { fontSize: 15, fontWeight: '600', color: C.textHigh },
  registerVehicleSub:     { fontSize: 12, color: C.textLow, marginTop: 2 },
  registerVehicleArrow:   { fontSize: 24, fontWeight: '700', color: C.textLow },

  deletingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  deletingText:{ fontSize: 13, color: C.error },

  // Logout
  logoutBtn: {
    borderWidth:     1,
    borderColor:     C.error,
    borderRadius:    16,
    paddingVertical: 14,
    alignItems:      'center',
    marginTop:       Spacing.sm,
  },
  logoutText: { color: C.error, fontWeight: '600', fontSize: 15 },
});
