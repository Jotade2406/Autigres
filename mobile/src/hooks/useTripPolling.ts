import { useEffect, useRef, useCallback } from 'react';
import { tripsApi } from '../api/trips.api';
import { useTripStore } from '../store/trip.store';

const POLL_INTERVAL_MS = 3_000;
const TERMINAL_STATUSES = new Set(['matched', 'assigned', 'cancelled', 'expired']);

export function useTripPolling(
  requestUuid: string | null,
  onAssigned: (tripUuid: string) => void,
) {
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep onAssigned current without listing it as an effect dependency.
  // This avoids recreating `poll` (and re-running the effect) on every render
  // of the parent component (MatchingScreen re-renders every second from the timer).
  const onAssignedRef = useRef(onAssigned);
  onAssignedRef.current = onAssigned;

  useEffect(() => {
    if (!requestUuid) return;

    // Read actions via getState() — they are stable Zustand references and do NOT
    // create a store subscription, so isPolling changes won't cause re-renders here.
    const { setCurrentRequest, setActiveTrip, setPolling } = useTripStore.getState();

    const stop = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setPolling(false);
    };

    const poll = async () => {
      try {
        const status = await tripsApi.getRequest(requestUuid);
        setCurrentRequest(status);

        if (TERMINAL_STATUSES.has(status.status)) {
          stop();
          if (status.assignedTrip) {
            setActiveTrip(status.assignedTrip);
            onAssignedRef.current(status.assignedTrip.tripUuid);
          }
        }
      } catch {
        // transient network error — interval will retry
      }
    };

    setPolling(true);
    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return stop;
  }, [requestUuid]); // only the UUID drives effect lifecycle

  // Exposed so callers (e.g. cancel button) can stop polling imperatively.
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    useTripStore.getState().setPolling(false);
  }, []);

  return { stopPolling };
}
