import type { LatLng } from 'react-native-maps';
import { GOOGLE_MAPS_API_KEY } from '../config/maps';
import { tripsApi } from '../api/trips.api';

// ── In-memory cache ───────────────────────────────────────────────────────────

export interface RouteInfo {
  polyline:        LatLng[];
  distanceKm:      number;
  durationMinutes: number;
}

const cache = new Map<string, RouteInfo>();

function round4(n: number) { return Math.round(n * 10000) / 10000; }

function cacheKey(o: LatLng, d: LatLng) {
  return `${round4(o.latitude)},${round4(o.longitude)}|${round4(d.latitude)},${round4(d.longitude)}`;
}

// ── Google Encoded Polyline decoder ───────────────────────────────────────────

function decodePolyline(encoded: string, precision = 1e5): LatLng[] {
  const result: LatLng[] = [];
  let i = 0, lat = 0, lng = 0;
  while (i < encoded.length) {
    let shift = 0, bits = 0, byte: number;
    do { byte = encoded.charCodeAt(i++) - 63; bits |= (byte & 0x1f) << shift; shift += 5; }
    while (byte >= 0x20);
    lat += bits & 1 ? ~(bits >> 1) : bits >> 1;
    shift = 0; bits = 0;
    do { byte = encoded.charCodeAt(i++) - 63; bits |= (byte & 0x1f) << shift; shift += 5; }
    while (byte >= 0x20);
    lng += bits & 1 ? ~(bits >> 1) : bits >> 1;
    result.push({ latitude: lat / precision, longitude: lng / precision });
  }
  return result;
}

// ── Haversine straight-line distance (km) ─────────────────────────────────────

function haversineKm(o: LatLng, d: LatLng): number {
  const R = 6371;
  const dLat = (d.latitude  - o.latitude)  * Math.PI / 180;
  const dLng = (d.longitude - o.longitude) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(o.latitude * Math.PI / 180) * Math.cos(d.latitude * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Routing providers ─────────────────────────────────────────────────────────

async function tryBackend(o: LatLng, d: LatLng): Promise<RouteInfo | null> {
  try {
    const data = await tripsApi.getShortestPath(o.latitude, o.longitude, d.latitude, d.longitude);
    if (!data.polyline?.length || data.polyline.length < 2) return null;
    return {
      polyline:        data.polyline.map(p => ({ latitude: p.lat, longitude: p.lng })),
      distanceKm:      data.totalDistanceMeters / 1000,
      durationMinutes: data.totalTimeSeconds / 60,
    };
  } catch { return null; }
}

async function tryGoogle(o: LatLng, d: LatLng): Promise<RouteInfo | null> {
  if (!GOOGLE_MAPS_API_KEY) return null;
  try {
    const url =
      `https://maps.googleapis.com/maps/api/directions/json` +
      `?origin=${o.latitude},${o.longitude}` +
      `&destination=${d.latitude},${d.longitude}` +
      `&key=${GOOGLE_MAPS_API_KEY}`;
    const json = await fetch(url).then(r => r.json());
    if (json.status !== 'OK' || !json.routes?.length) return null; // silently fall through
    const leg = json.routes[0].legs?.[0];
    return {
      polyline:        decodePolyline(json.routes[0].overview_polyline.points),
      distanceKm:      (leg?.distance?.value ?? 0) / 1000,
      durationMinutes: (leg?.duration?.value  ?? 0) / 60,
    };
  } catch { return null; }
}

async function tryOSRM(o: LatLng, d: LatLng): Promise<RouteInfo | null> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${o.longitude},${o.latitude};${d.longitude},${d.latitude}` +
      `?overview=full&geometries=polyline`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    let json: any;
    try {
      json = await fetch(url, { signal: controller.signal }).then(r => r.json());
    } finally {
      clearTimeout(timeout);
    }
    if (json.code !== 'Ok' || !json.routes?.length) return null;
    const route = json.routes[0];
    return {
      polyline:        decodePolyline(route.geometry),
      distanceKm:      (route.distance ?? 0) / 1000,
      durationMinutes: (route.duration ?? 0) / 60,
    };
  } catch { return null; }
}

// ── Fare calculator (client-side) ─────────────────────────────────────────────
// Base: Bs. 5 + Bs. 2.50/km + Bs. 0.50/min. Road distance already real from OSRM.

export function estimateFare(distanceKm: number, durationMinutes: number): number {
  const fare = 5 + distanceKm * 2.50 + durationMinutes * 0.50;
  return Math.max(5, Math.round(fare));
}

export function estimatePooledFare(distanceKm: number, durationMinutes: number): number {
  return Math.round(estimateFare(distanceKm, durationMinutes) * 0.70);
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getRouteInfo(origin: LatLng, destination: LatLng): Promise<RouteInfo> {
  const straightKm = haversineKm(origin, destination);
  const fallback: RouteInfo = {
    polyline:        [{ latitude: origin.latitude, longitude: origin.longitude },
                      { latitude: destination.latitude, longitude: destination.longitude }],
    distanceKm:      straightKm * 1.3, // road distance ≈ 1.3× straight line
    durationMinutes: (straightKm * 1.3) / 30 * 60, // ~30 km/h average urban speed → minutes
  };

  if (
    round4(origin.latitude)  === round4(destination.latitude) &&
    round4(origin.longitude) === round4(destination.longitude)
  ) return { polyline: [], distanceKm: 0, durationMinutes: 0 };

  const key    = cacheKey(origin, destination);
  const cached = cache.get(key);
  if (cached) return cached;

  const result = (await tryOSRM(origin, destination))
    ?? (await tryGoogle(origin, destination));
  if (result && result.polyline.length >= 2) {
    cache.set(key, result);
    return result;
  }

  return fallback;
}

/** Backwards-compat wrapper — returns only the polyline. */
export async function getDirectionsPolyline(origin: LatLng, destination: LatLng): Promise<LatLng[]> {
  return (await getRouteInfo(origin, destination)).polyline;
}
