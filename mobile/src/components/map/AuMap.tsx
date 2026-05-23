import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, Region, LatLng } from 'react-native-maps';
import { Colors } from '../../theme/colors';
import type { WaypointDto } from '../../api/types';

const SANTA_CRUZ: Region = {
  latitude: -17.7833,
  longitude: -63.1821,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0D0D14' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8B8BA0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0D0D14' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1F1F2E' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#2A2A3E' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#161620' }] },
];

interface EdgePadding { top: number; right: number; bottom: number; left: number }

interface AuMapProps {
  userLocation?: LatLng;
  waypoints?: WaypointDto[];
  /** When provided, drawn instead of the waypoint-derived straight line. */
  polyline?: LatLng[];
  /** When provided, the map auto-fits to show all these coordinates. */
  fitToCoords?: LatLng[];
  /** Edge padding used when fitToCoords is set (default: 60px all sides). */
  fitPadding?: EdgePadding;
  style?: object;
  children?: React.ReactNode;
}

const DEFAULT_PADDING: EdgePadding = { top: 60, right: 60, bottom: 60, left: 60 };

export function AuMap({ userLocation, waypoints = [], polyline, fitToCoords, fitPadding = DEFAULT_PADDING, style, children }: AuMapProps) {
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (!fitToCoords || fitToCoords.length < 2) return;
    const t = setTimeout(() => {
      mapRef.current?.fitToCoordinates(fitToCoords, { edgePadding: fitPadding, animated: true });
    }, 300);
    return () => clearTimeout(t);
  }, [fitToCoords, fitPadding]);

  const waypointCoords = useMemo(
    () => waypoints.map((w) => ({ latitude: w.lat, longitude: w.lng })),
    [waypoints],
  );
  const routeCoords = useMemo(
    () => (polyline && polyline.length >= 2 ? polyline : null),
    [polyline],
  );
  // Real road route has many points; 2-point = straight-line fallback when OSRM fails.
  const isRealRoute = polyline ? polyline.length > 2 : false;
  const pickups = useMemo(
    () => waypoints.filter((w) => w.waypointType === 'pickup'),
    [waypoints],
  );
  const dropoffs = useMemo(
    () => waypoints.filter((w) => w.waypointType === 'dropoff'),
    [waypoints],
  );

  return (
    <MapView
      ref={mapRef}
      style={[styles.map, style]}
      initialRegion={SANTA_CRUZ}
      customMapStyle={darkMapStyle}
      showsUserLocation={false}
      showsMyLocationButton={false}
    >
      {userLocation && (
        <Marker coordinate={userLocation} title="Tu ubicación">
          <View style={styles.userDot} />
        </Marker>
      )}

      {pickups.map((w, i) => (
        <Marker
          key={`pickup-${i}`}
          coordinate={{ latitude: w.lat, longitude: w.lng }}
          pinColor={Colors.accent}
          title={`Pickup ${i + 1}`}
        />
      ))}

      {dropoffs.map((w, i) => (
        <Marker
          key={`dropoff-${i}`}
          coordinate={{ latitude: w.lat, longitude: w.lng }}
          pinColor={Colors.error}
          title={`Dropoff ${i + 1}`}
        />
      ))}

      {routeCoords && (
        <Polyline
          coordinates={routeCoords}
          strokeColor={isRealRoute ? Colors.primary : Colors.primary + '70'}
          strokeWidth={isRealRoute ? 3 : 2}
          lineDashPattern={isRealRoute ? undefined : [10, 8]}
        />
      )}

      {children}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  userDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.textHigh,
  },
});
