import { create } from 'zustand';
import type { TripRequestStatusDto, TripResponseDto } from '../api/types';

interface TripState {
  currentRequest: TripRequestStatusDto | null;
  activeTrip: TripResponseDto | null;
  isPolling: boolean;
  setCurrentRequest: (r: TripRequestStatusDto | null) => void;
  setActiveTrip: (t: TripResponseDto | null) => void;
  setPolling: (v: boolean) => void;
  clearTrip: () => void;
}

export const useTripStore = create<TripState>((set) => ({
  currentRequest: null,
  activeTrip: null,
  isPolling: false,

  setCurrentRequest: (r) => set({ currentRequest: r }),
  setActiveTrip: (t) => set({ activeTrip: t }),
  setPolling: (v) => set({ isPolling: v }),
  clearTrip: () => set({ currentRequest: null, activeTrip: null, isPolling: false }),
}));
