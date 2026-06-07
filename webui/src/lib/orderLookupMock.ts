import type { LogisticsOrder } from '@/types';

function densify(waypoints: [number, number][], stepsPerLeg = 12): [number, number][] {
  if (waypoints.length === 0) return [];
  if (waypoints.length === 1) return [waypoints[0]!];
  const out: [number, number][] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i]!;
    const b = waypoints[i + 1]!;
    for (let s = 0; s < stepsPerLeg; s++) {
      const t = s / stepsPerLeg;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  out.push(waypoints[waypoints.length - 1]!);
  return out;
}

const C = {
  omaha: [41.2565, -95.9345] as [number, number],
  denver: [39.7392, -104.9903] as [number, number],
  kingman: [35.187, -114.053] as [number, number],
  la: [34.0522, -118.2437] as [number, number],
  chicago: [41.8781, -87.6298] as [number, number],
  memphis: [35.1495, -90.049] as [number, number],
  houston: [29.7604, -95.3698] as [number, number],
  houstonMetro: [29.85, -95.45] as [number, number],
  atlanta: [33.749, -84.388] as [number, number],
  miami: [25.7617, -80.1918] as [number, number],
  newark: [40.7357, -74.1724] as [number, number],
  okc: [35.4676, -97.5164] as [number, number],
  austin: [30.2672, -97.7431] as [number, number],
  winnipeg: [49.8951, -97.1384] as [number, number],
  minneapolis: [44.9778, -93.265] as [number, number],
};

/** Deterministic demo orders for order lookup (no network). */
export const MOCK_LOGISTICS_ORDERS: LogisticsOrder[] = [
  {
    id: 'FM-2026-104821',
    customerPo: 'PO-NSTAR-77821',
    bol: 'BOL-US-44829103',
    containerId: 'MSCU 928104-6',
    status: 'in_transit',
    statusLabel: 'In transit',
    shipper: 'Great Plains Foods — Omaha, NE',
    consignee: 'Harbor Fresh DC — Los Angeles, CA',
    origin: 'Omaha, NE',
    destination: 'Los Angeles, CA',
    commodity: 'Frozen palletized produce — Reefer',
    weightLbs: 38_420,
    pieces: 24,
    assignedUnitId: 'TR-8844',
    driverName: 'Maria Chen',
    createdIso: '2026-04-28T14:22:00.000Z',
    etaIso: '2026-05-02T22:00:00.000Z',
    traveledPath: densify([C.omaha, C.denver, C.kingman], 14),
    remainingPath: densify([C.kingman, C.la], 14),
    mapStops: [
      { seq: 1, lat: C.omaha[0], lng: C.omaha[1], name: 'Pickup · Omaha' },
      { seq: 2, lat: C.denver[0], lng: C.denver[1], name: 'Relay · Denver' },
      { seq: 3, lat: C.kingman[0], lng: C.kingman[1], name: 'In transit · I-40 AZ' },
      { seq: 4, lat: C.la[0], lng: C.la[1], name: 'Delivery · Los Angeles' },
    ],
    events: [
      {
        id: 'e1',
        atIso: '2026-04-28T14:22:00.000Z',
        label: 'Booking confirmed',
        detail: 'Tender accepted · contract rate',
        location: 'Omaha, NE',
      },
      {
        id: 'e2',
        atIso: '2026-04-29T09:05:00.000Z',
        label: 'Pickup complete',
        detail: 'BOL signed · seal intact',
        location: 'Omaha, NE',
      },
      {
        id: 'e3',
        atIso: '2026-04-30T16:40:00.000Z',
        label: 'Relay handoff',
        detail: 'TR-8844 assumed load westbound',
        location: 'Denver, CO',
      },
      {
        id: 'e4',
        atIso: '2026-05-01T11:12:00.000Z',
        label: 'In transit · on schedule',
        detail: 'GPS ping · reefer −18°C',
        location: 'I-40, AZ',
      },
    ],
  },
  {
    id: 'FM-2026-093102',
    customerPo: 'PO-ACME-00931',
    bol: 'BOL-US-99120044',
    containerId: null,
    status: 'out_for_delivery',
    statusLabel: 'Out for delivery',
    shipper: 'Midwest Coil — Chicago, IL',
    consignee: 'BuildRight Steel — Houston, TX',
    origin: 'Chicago, IL',
    destination: 'Houston, TX',
    commodity: 'Steel coils — flatbed · OD permit',
    weightLbs: 46_800,
    pieces: 8,
    assignedUnitId: 'TR-9012',
    driverName: 'James Okafor',
    createdIso: '2026-04-26T08:00:00.000Z',
    etaIso: '2026-05-01T19:30:00.000Z',
    traveledPath: densify([C.chicago, C.memphis, C.houstonMetro], 14),
    remainingPath: densify([C.houstonMetro, C.houston], 8),
    mapStops: [
      { seq: 1, lat: C.chicago[0], lng: C.chicago[1], name: 'Pickup · Chicago' },
      { seq: 2, lat: C.memphis[0], lng: C.memphis[1], name: 'En route · Memphis' },
      { seq: 3, lat: C.houston[0], lng: C.houston[1], name: 'Delivery · Houston' },
    ],
    events: [
      {
        id: 'e1',
        atIso: '2026-04-26T08:00:00.000Z',
        label: 'Booked',
        location: 'Chicago, IL',
      },
      {
        id: 'e2',
        atIso: '2026-04-27T13:20:00.000Z',
        label: 'Loaded & departed',
        detail: 'OD flags active',
      },
      {
        id: 'e3',
        atIso: '2026-05-01T06:00:00.000Z',
        label: 'Arrived metro · out for delivery',
        location: 'Houston, TX',
      },
    ],
  },
  {
    id: 'FM-2026-088900',
    customerPo: 'PO-SUNCO-22100',
    bol: 'BOL-US-77200991',
    containerId: 'TEMU 110982-3',
    status: 'delivered',
    statusLabel: 'Delivered',
    shipper: 'SunCo Packaging — Atlanta, GA',
    consignee: 'Retail Hub — Miami, FL',
    origin: 'Atlanta, GA',
    destination: 'Miami, FL',
    commodity: 'PACK · corrugate rolls',
    weightLbs: 12_900,
    pieces: 132,
    assignedUnitId: 'TR-8710',
    driverName: 'Priya Nguyen',
    createdIso: '2026-04-20T10:15:00.000Z',
    etaIso: '2026-04-24T16:00:00.000Z',
    traveledPath: densify([C.atlanta, C.miami], 18),
    remainingPath: [],
    mapStops: [
      { seq: 1, lat: C.atlanta[0], lng: C.atlanta[1], name: 'Pickup · Atlanta' },
      { seq: 2, lat: C.miami[0], lng: C.miami[1], name: 'Delivered · Miami' },
    ],
    events: [
      {
        id: 'e1',
        atIso: '2026-04-20T10:15:00.000Z',
        label: 'Booked',
      },
      {
        id: 'e2',
        atIso: '2026-04-21T07:00:00.000Z',
        label: 'Picked up',
        location: 'Atlanta, GA',
      },
      {
        id: 'e3',
        atIso: '2026-04-24T14:08:00.000Z',
        label: 'Delivered · POD captured',
        detail: 'Signed · photo verified',
        location: 'Miami, FL',
      },
    ],
  },
  {
    id: 'FM-2026-101004',
    customerPo: 'PO-RELI-88104',
    bol: 'BOL-US-33004412',
    containerId: null,
    status: 'exception',
    statusLabel: 'Exception',
    shipper: 'Reliable Chem — NJ',
    consignee: 'Lab Supply Co — Austin, TX',
    origin: 'Newark, NJ',
    destination: 'Austin, TX',
    commodity: 'Hazmat Class 3 · UN1203',
    weightLbs: 18_200,
    pieces: 6,
    assignedUnitId: 'TR-9155',
    driverName: 'David Burke',
    createdIso: '2026-04-29T18:00:00.000Z',
    etaIso: null,
    traveledPath: densify([C.newark, C.okc], 16),
    remainingPath: densify([C.okc, C.austin], 14),
    mapStops: [
      { seq: 1, lat: C.newark[0], lng: C.newark[1], name: 'Pickup · Newark' },
      { seq: 2, lat: C.okc[0], lng: C.okc[1], name: 'Hold · Oklahoma City' },
      { seq: 3, lat: C.austin[0], lng: C.austin[1], name: 'Planned · Austin' },
    ],
    events: [
      {
        id: 'e1',
        atIso: '2026-04-29T18:00:00.000Z',
        label: 'Booked · hazmat cleared',
      },
      {
        id: 'e2',
        atIso: '2026-04-30T21:44:00.000Z',
        label: 'Weather hold · I-40 closure',
        detail: 'Dispatcher notified customer',
        location: 'Oklahoma City, OK',
      },
      {
        id: 'e3',
        atIso: '2026-05-01T07:10:00.000Z',
        label: 'Revised ETA pending',
        detail: 'Awaiting corridor restart',
      },
    ],
  },
  {
    id: 'FM-2026-077210',
    customerPo: 'PO-HUB-77210',
    bol: 'BOL-CA-99120001',
    containerId: null,
    status: 'booked',
    statusLabel: 'Booked',
    shipper: 'Prairie Grain — Winnipeg',
    consignee: 'US Mill — Minneapolis, MN',
    origin: 'Winnipeg, MB',
    destination: 'Minneapolis, MN',
    commodity: 'Bulk grain · hopper',
    weightLbs: 54_000,
    pieces: 1,
    assignedUnitId: null,
    driverName: null,
    createdIso: '2026-05-01T09:00:00.000Z',
    etaIso: '2026-05-05T12:00:00.000Z',
    traveledPath: [],
    remainingPath: densify([C.winnipeg, C.minneapolis], 16),
    mapStops: [
      { seq: 1, lat: C.winnipeg[0], lng: C.winnipeg[1], name: 'Origin · Winnipeg' },
      { seq: 2, lat: C.minneapolis[0], lng: C.minneapolis[1], name: 'Dest · Minneapolis' },
    ],
    events: [
      {
        id: 'e1',
        atIso: '2026-05-01T09:00:00.000Z',
        label: 'Tender accepted',
        detail: 'Carrier assignment pending',
        location: 'Winnipeg, MB',
      },
    ],
  },
];

export function searchMockOrders(query: string): LogisticsOrder[] {
  const q = query.trim().toLowerCase();
  if (!q) return MOCK_LOGISTICS_ORDERS;
  return MOCK_LOGISTICS_ORDERS.filter((o) => {
    const hay = [
      o.id,
      o.customerPo,
      o.bol,
      o.containerId ?? '',
      o.shipper,
      o.consignee,
      o.origin,
      o.destination,
      o.assignedUnitId ?? '',
      o.driverName ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}
