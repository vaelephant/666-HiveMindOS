export type ViewType =
  | 'dashboard'
  | 'master'
  | 'inbound'
  | 'outbound'
  | 'inventory'
  | 'slot-ai'
  | 'stocktake'
  | 'devices'
  | 'analytics'
  | 'ai-brain'
  | 'settings';

/** Telemetry tri-state used on map markers and health badges */
export type FleetTelemetryStatus = 'operational' | 'warning' | 'error';

/** Human-readable motion / dispatch state for roster UI */
export type FleetMotionLabel = 'In Motion' | 'Idle' | 'Delayed' | 'In Transit' | 'Offline';

export interface FleetVehicle {
  id: string;
  vin: string;
  makeModel: string;
  driverName: string;
  lat: number;
  lng: number;
  headingDeg: number;
  speedMph: number;
  speedDisplay: string;
  fuelPct: number;
  fuelDisplay: string;
  telemetryStatus: FleetTelemetryStatus;
  motionLabel: FleetMotionLabel;
  corridorLabel: string;
  ambientTempC: number;
  ambientTempDisplay: string;
  engineTempF: number;
  loadWeightLbs: number;
  odometerMiles: number;
  lastPingIso: string;
}

export interface FleetSnapshot {
  generatedAt: string;
  seed: number;
  count: number;
  summary: {
    operational: number;
    warning: number;
    error: number;
    inMotion: number;
    idle: number;
    avgSpeedMph: number;
  };
  vehicles: FleetVehicle[];
  /** Wall-clock ms the server used to compute positions (mock or replay). */
  serverTimeMs?: number;
  /** Provider identifier: `mock-time` today; future e.g. `telematics-v1`. */
  source?: string;
}

export interface KPIStats {
  label: string;
  value: string;
  trend: string;
  trendType: 'positive' | 'negative' | 'neutral';
  icon: string;
}

export interface Transmission {
  id: string;
  driver: string;
  vehicle: string;
  route: string;
  eta: string;
  riskScore: number;
}

/** Route planning (MVP mock / future OR-Tools API) */
export type RoutePlanProfileId = 'fastest' | 'cheapest';

export type RoutePlanStopType = 'pickup' | 'rest' | 'dropoff' | 'fuel' | 'relay';

export interface RoutePlanStop {
  id: string;
  sequence: number;
  name: string;
  type: RoutePlanStopType;
  estTimeLabel: string;
  lat: number;
  lng: number;
}

export interface RoutePlanProfile {
  id: RoutePlanProfileId;
  durationMinutes: number;
  durationLabel: string;
  tollUsd: number;
  fuelUsd: number;
  timeCostUsd: number;
  operatingCostUsd: number;
  polyline: [number, number][];
}

export type RoutePlanConstraintStatus = 'ok' | 'warn' | 'block';

export interface RoutePlanConstraint {
  id: string;
  title: string;
  subtitle: string;
  status: RoutePlanConstraintStatus;
  kind: 'driver' | 'vehicle' | 'hazmat';
}

export interface RoutePlanOptimizeResponse {
  stops: RoutePlanStop[];
  profiles: RoutePlanProfile[];
  constraints: RoutePlanConstraint[];
  defaultProfileId: RoutePlanProfileId;
}

/** Logistics shipment / order for lookup (mock or API) */
export type LogisticsOrderStatus =
  | 'booked'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'exception';

export interface LogisticsOrderEvent {
  id: string;
  atIso: string;
  label: string;
  detail?: string;
  location?: string;
}

/** Map pins for order milestones (pickup, handoffs, current, delivery). */
export interface LogisticsOrderMapStop {
  seq: number;
  lat: number;
  lng: number;
  name: string;
}

export interface LogisticsOrder {
  id: string;
  customerPo: string;
  bol: string;
  containerId: string | null;
  status: LogisticsOrderStatus;
  statusLabel: string;
  shipper: string;
  consignee: string;
  origin: string;
  destination: string;
  commodity: string;
  weightLbs: number;
  pieces: number;
  assignedUnitId: string | null;
  driverName: string | null;
  createdIso: string;
  etaIso: string | null;
  events: LogisticsOrderEvent[];
  /** Completed corridor (lat, lng) for map — truck animates here */
  traveledPath: [number, number][];
  /** Planned remainder (lat, lng), faint dashed on map */
  remainingPath: [number, number][];
  /** Numbered markers on map */
  mapStops: LogisticsOrderMapStop[];
}
