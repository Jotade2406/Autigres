import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TripResponseDto } from '../api/types';

const DRIVER_TRIP_KEY = 'driver_current_trip_uuid';

interface DriverState {
  isOnline: boolean;
  currentTrip: TripResponseDto | null;
  currentTripUuid: string | null;
  currentLat: number | null;
  currentLng: number | null;
  setOnline: (v: boolean) => void;
  setCurrentTrip: (t: TripResponseDto | null) => void;
  setCurrentTripUuid: (uuid: string | null) => Promise<void>;
  updateLocation: (lat: number, lng: number) => void;
  restoreDriverTrip: () => Promise<void>;
}

export const useDriverStore = create<DriverState>((set) => ({
  isOnline: false,
  currentTrip: null,
  currentTripUuid: null,
  currentLat: null,
  currentLng: null,

  setOnline: (v) => set({ isOnline: v }),
  setCurrentTrip: (t) => set({ currentTrip: t }),

  setCurrentTripUuid: async (uuid) => {
    if (uuid) {
      await AsyncStorage.setItem(DRIVER_TRIP_KEY, uuid);
    } else {
      await AsyncStorage.removeItem(DRIVER_TRIP_KEY);
    }
    set({ currentTripUuid: uuid });
  },

  updateLocation: (lat, lng) => set({ currentLat: lat, currentLng: lng }),

  restoreDriverTrip: async () => {
    try {
      const uuid = await AsyncStorage.getItem(DRIVER_TRIP_KEY);
      if (uuid) set({ currentTripUuid: uuid });
    } catch { /* ignore */ }
  },
}));
