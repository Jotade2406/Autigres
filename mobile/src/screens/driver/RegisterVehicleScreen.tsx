import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Car, Pencil } from 'lucide-react-native';
import { AuButton }    from '../../components/ui/AuButton';
import { AuCard }      from '../../components/ui/AuCard';
import { driversApi }  from '../../api/drivers.api';
import { Colors }      from '../../theme/colors';
import { Typography }  from '../../theme/typography';
import { Spacing }     from '../../theme/spacing';
import type { DriverStackParamList } from '../../navigation/DriverNavigator';

type Props = NativeStackScreenProps<DriverStackParamList, 'RegisterVehicle'>;

export function RegisterVehicleScreen({ route, navigation }: Props) {
  const params     = route.params;
  const isEditMode = !!(params?.vehicleId);

  const [plate,    setPlate]    = useState(params?.plateNumber ?? '');
  const [brand,    setBrand]    = useState(params?.brand       ?? '');
  const [model,    setModel]    = useState(params?.model       ?? '');
  const [year,     setYear]     = useState(params?.year        ?? '');
  const [color,    setColor]    = useState(params?.color       ?? '');
  const [capacity, setCapacity] = useState(params?.capacity    ?? '4');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async () => {
    if (!plate.trim() || !brand.trim() || !model.trim() || !year.trim() || !color.trim()) {
      Alert.alert('Campos requeridos', 'Completá todos los campos para continuar.');
      return;
    }
    const yearNum = parseInt(year, 10);
    if (isNaN(yearNum) || yearNum < 1990 || yearNum > new Date().getFullYear() + 1) {
      Alert.alert('Año inválido', 'Ingresá un año válido.');
      return;
    }
    const capacityNum = parseInt(capacity, 10);
    if (isNaN(capacityNum) || capacityNum < 1 || capacityNum > 8) {
      Alert.alert('Capacidad inválida', 'La capacidad debe estar entre 1 y 8.');
      return;
    }

    const dto = {
      plateNumber: plate.trim().toUpperCase(),
      brand:       brand.trim(),
      model:       model.trim(),
      year:        yearNum,
      color:       color.trim(),
      capacity:    capacityNum,
    };

    setLoading(true);
    try {
      if (isEditMode) {
        await driversApi.updateVehicle(params!.vehicleId!, dto);
        Alert.alert('Vehículo actualizado', 'Los datos del vehículo fueron guardados.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        await driversApi.registerVehicle(dto);
        Alert.alert('Vehículo registrado', 'Tu vehículo fue registrado con éxito. Ya podés aceptar viajes.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch {
      Alert.alert('Error', 'No se pudo guardar el vehículo. Verificá los datos e intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.iconCircle}>
          {isEditMode
            ? <Pencil size={28} color={Colors.primary} strokeWidth={1.5} />
            : <Car size={28} color={Colors.primary} strokeWidth={1.5} />}
        </View>
        <Text style={[Typography.h2, styles.title]}>
          {isEditMode ? 'Editar vehículo' : 'Registrá tu vehículo'}
        </Text>
        <Text style={[Typography.body, styles.subtitle]}>
          {isEditMode
            ? 'Actualizá los datos de tu vehículo'
            : 'Necesitás un vehículo activo para aceptar viajes'}
        </Text>

        <AuCard style={styles.formCard}>
          <Field label="Placa / Matrícula" value={plate}
            onChange={v => setPlate(v.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
            placeholder="Ej: 1234ABC" autoCapitalize="characters" maxLength={8} />
          <Field label="Marca" value={brand} onChange={setBrand}
            placeholder="Ej: Toyota" />
          <Field label="Modelo" value={model} onChange={setModel}
            placeholder="Ej: Corolla" />
          <Field label="Año" value={year} onChange={setYear}
            placeholder={`Ej: ${new Date().getFullYear()}`} keyboardType="number-pad" />
          <Field label="Color" value={color} onChange={setColor}
            placeholder="Ej: Blanco" />
          <Field label="Capacidad (pasajeros)" value={capacity} onChange={setCapacity}
            placeholder="4" keyboardType="number-pad" />
        </AuCard>

        <AuButton
          label={isEditMode ? 'Guardar cambios' : 'Registrar vehículo'}
          onPress={handleSubmit}
          loading={loading}
          style={styles.btn}
        />
        <AuButton
          label="Cancelar"
          variant="secondary"
          onPress={() => navigation.goBack()}
          style={styles.btnCancel}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  maxLength?: number;
}

function Field({ label, value, onChange, placeholder, keyboardType = 'default', autoCapitalize = 'words', maxLength }: FieldProps) {
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={fieldStyles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.textLow}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
      />
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap:  { gap: 4, marginBottom: Spacing.sm },
  label: { ...Typography.label, color: Colors.textMid },
  input: {
    backgroundColor: Colors.bgPrimary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.textHigh,
    fontSize: 15,
  },
});

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.bgPrimary },
  container: {
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1.5,
    borderColor: Colors.primary + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title:    { textAlign: 'center' },
  subtitle: { textAlign: 'center', color: Colors.textMid },
  formCard: { width: '100%', gap: 0 },
  btn:       { width: '100%' },
  btnCancel: { width: '100%' },
});
