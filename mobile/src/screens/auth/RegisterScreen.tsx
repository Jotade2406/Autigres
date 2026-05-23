import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Car, User, ChevronLeft } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { authApi } from '../../api/auth.api';
import { useAuthStore } from '../../store/auth.store';
import { AuInput }  from '../../components/ui/AuInput';
import { AuButton } from '../../components/ui/AuButton';
import { Colors }    from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing }    from '../../theme/spacing';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type Role = 'passenger' | 'driver';
type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const { login } = useAuthStore();
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [phone,     setPhone]     = useState('');
  const [password,  setPassword]  = useState('');
  const [role,      setRole]      = useState<Role>('passenger');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  const handleRegister = async () => {
    if (!firstName || !lastName || !email || !phone || !password) {
      setError('Completá todos los campos.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const response = await authApi.register({
        firstName: firstName.trim(),
        lastName:  lastName.trim(),
        email:     email.trim(),
        phone:     phone.trim(),
        password,
        role,
      });
      await login(response);
    } catch {
      setError('No se pudo crear la cuenta. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
            <View style={styles.backInner}>
              <ChevronLeft size={20} color={Colors.textMid} />
              <Text style={styles.backText}>Volver</Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.title}>Crear cuenta</Text>

          <Text style={Typography.label}>Soy...</Text>
          <View style={styles.roleRow}>
            {(['driver', 'passenger'] as Role[]).map((r) => {
              const active = role === r;
              const iconColor = active ? Colors.primary : Colors.textLow;
              return (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleCard, active && styles.roleCardActive]}
                  onPress={() => setRole(r)}
                >
                  {r === 'driver'
                    ? <Car size={28} color={iconColor} strokeWidth={1.5} />
                    : <User size={28} color={iconColor} strokeWidth={1.5} />}
                  <Text style={[styles.roleLabel, active && { color: Colors.primary }]}>
                    {r === 'driver' ? 'Soy conductor' : 'Soy pasajero'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <AuInput label="Nombre" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
          <AuInput label="Apellido" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
          <AuInput label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
          <AuInput label="Teléfono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <AuInput label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry />

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <AuButton label="Crear cuenta" onPress={handleRegister} loading={loading} style={styles.btn} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bgPrimary },
  kav:    { flex: 1 },
  scroll: { flexGrow: 1, padding: Spacing.lg },
  back:   { marginBottom: Spacing.md },
  backInner: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { color: Colors.textMid, fontSize: 15 },
  title:  { ...Typography.h1, marginBottom: Spacing.lg },
  roleRow: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: Spacing.lg },
  roleCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 6,
  },
  roleCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryDim },
  roleLabel: { ...Typography.body, textAlign: 'center' },
  errorText: { color: Colors.error, fontSize: 13, marginBottom: Spacing.sm, textAlign: 'center' },
  btn: { marginTop: Spacing.sm },
});
