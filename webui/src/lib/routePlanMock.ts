import type {
  RoutePlanConstraint,
  RoutePlanOptimizeResponse,
  RoutePlanProfile,
  RoutePlanStop,
} from '@/types';

/**
 * Atlanta → Birmingham → Nashville → Little Rock → Memphis → St Louis → Kansas City
 * Fastest: straighter mids; Cheapest: extra southern detour segment (mock).
 */
const fastestRing: [number, number][] = [
  [33.749, -84.388],
  [33.62, -85.08],
  [33.5207, -86.8025],
  [34.15, -86.65],
  [36.1627, -86.7816],
  [35.55, -88.85],
  [34.7465, -92.2896],
  [34.98, -91.12],
  [35.1495, -90.049],
  [36.45, -89.95],
  [37.55, -90.05],
  [38.627, -90.1994],
  [38.92, -92.05],
  [39.0997, -94.5786],
];

const cheapestRing: [number, number][] = [
  [33.749, -84.388],
  [33.48, -85.4],
  [33.5207, -86.8025],
  [32.95, -87.35],
  [34.05, -86.95],
  [36.1627, -86.7816],
  [35.2, -89.2],
  [34.7465, -92.2896],
  [35.05, -90.85],
  [35.1495, -90.049],
  [36.1, -90.35],
  [37.2, -90.55],
  [38.627, -90.1994],
  [38.75, -92.85],
  [39.0997, -94.5786],
];

const stops: RoutePlanStop[] = [
  {
    id: 's1',
    sequence: 1,
    name: 'Atlanta, GA',
    type: 'pickup',
    estTimeLabel: '06:15 AM',
    lat: 33.749,
    lng: -84.388,
  },
  {
    id: 's2',
    sequence: 2,
    name: 'Birmingham, AL',
    type: 'fuel',
    estTimeLabel: '09:40 AM',
    lat: 33.5207,
    lng: -86.8025,
  },
  {
    id: 's3',
    sequence: 3,
    name: 'Nashville, TN',
    type: 'relay',
    estTimeLabel: '12:10 PM',
    lat: 36.1627,
    lng: -86.7816,
  },
  {
    id: 's4',
    sequence: 4,
    name: 'Little Rock, AR',
    type: 'rest',
    estTimeLabel: '03:35 PM',
    lat: 34.7465,
    lng: -92.2896,
  },
  {
    id: 's5',
    sequence: 5,
    name: 'Memphis, TN',
    type: 'relay',
    estTimeLabel: '06:05 PM',
    lat: 35.1495,
    lng: -90.049,
  },
  {
    id: 's6',
    sequence: 6,
    name: 'St Louis, MO',
    type: 'fuel',
    estTimeLabel: '09:50 PM',
    lat: 38.627,
    lng: -90.1994,
  },
  {
    id: 's7',
    sequence: 7,
    name: 'Kansas City, MO',
    type: 'dropoff',
    estTimeLabel: '02:40 AM',
    lat: 39.0997,
    lng: -94.5786,
  },
];

const profiles: RoutePlanProfile[] = [
  {
    id: 'fastest',
    durationMinutes: 1245,
    durationLabel: '20h 45m',
    tollUsd: 198,
    fuelUsd: 1125,
    timeCostUsd: 1087,
    operatingCostUsd: 2410,
    polyline: fastestRing,
  },
  {
    id: 'cheapest',
    durationMinutes: 1380,
    durationLabel: '23h 00m',
    tollUsd: 166,
    fuelUsd: 998,
    timeCostUsd: 1196,
    operatingCostUsd: 2360,
    polyline: cheapestRing,
  },
];

const constraints: RoutePlanConstraint[] = [
  {
    id: 'c1',
    title: 'John D. (Driver)',
    subtitle: 'HOS: 4h 12m remaining',
    status: 'ok',
    kind: 'driver',
  },
  {
    id: 'c2',
    title: 'Vehicle #901',
    subtitle: 'Weight check: 74,500 lbs',
    status: 'ok',
    kind: 'vehicle',
  },
  {
    id: 'c3',
    title: 'Tanker Hazmat',
    subtitle: 'Permit check required',
    status: 'warn',
    kind: 'hazmat',
  },
];

export function buildMockRoutePlanResponse(): RoutePlanOptimizeResponse {
  return {
    stops: structuredClone(stops),
    profiles: structuredClone(profiles),
    constraints: structuredClone(constraints),
    defaultProfileId: 'fastest',
  };
}
