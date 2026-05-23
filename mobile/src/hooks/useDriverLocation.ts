import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { driversApi } from '../api/drivers.api';
import { useDriverStore } from '../store/driver.store';

const LOCATION_INTERVAL_MS = 5_000;

export function useDriverLocation() {
  const { isOnline, updateLocation } = useDriverStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isOnline) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const sendLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { latitude: lat, longitude: lng } = pos.coords;

        updateLocation(lat, lng);
        await driversApi.updateLocation({ lat, lng });
      } catch {
        // GPS o red no disponibles → intentar en el próximo tick
      }
    };

    sendLocation();
    intervalRef.current = setInterval(sendLocation, LOCATION_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isOnline, updateLocation]);
}
