import type { ChartSeries, ChartSpec, ChartType } from '@/components/chat/charts/types';

const CHART_TYPES = new Set<ChartType>(['bar', 'line', 'pie']);
const X_KEY_CANDIDATES = ['date', 'time', 'label', 'name', 'x', 'month', 'day'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function coerceCell(v: unknown): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return null;
    const n = Number(t);
    if (t !== '' && !Number.isNaN(n) && Number.isFinite(n)) return n;
    return t;
  }
  return null;
}

function parseJsonLoose(raw: string): unknown | null {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Try to extract first {...} object (model may add trailing text)
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function parseSeries(raw: unknown, valueKey: string): ChartSeries[] | null {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [{ key: valueKey, name: '数值' }];
  }
  const series: ChartSeries[] = [];
  for (const item of raw) {
    if (!isRecord(item)) return null;
    const name = typeof item.name === 'string' ? item.name : typeof item.label === 'string' ? item.label : null;
    const key =
      typeof item.key === 'string'
        ? item.key
        : typeof item.dataKey === 'string'
          ? item.dataKey
          : name
            ? name.replace(/\s+/g, '_').toLowerCase()
            : null;
    if (!key || !name) return null;
    series.push({
      key,
      name,
      color: typeof item.color === 'string' ? item.color : undefined,
    });
  }
  return series;
}

function parseData(raw: unknown): Record<string, string | number>[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const rows: Record<string, string | number>[] = [];
  for (const row of raw) {
    if (!isRecord(row)) return null;
    const parsed: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(row)) {
      const cell = coerceCell(v);
      if (cell !== null) parsed[k] = cell;
    }
    if (Object.keys(parsed).length === 0) return null;
    rows.push(parsed);
  }
  return rows;
}

function inferXKey(data: Record<string, string | number>[], preferred: string): string {
  if (data.length > 0 && preferred in data[0]) return preferred;
  for (const key of X_KEY_CANDIDATES) {
    if (data.every((row) => key in row && typeof row[key] === 'string')) return key;
  }
  const first = data[0];
  for (const [k, v] of Object.entries(first)) {
    if (typeof v === 'string') return k;
  }
  return preferred;
}

function validateSeriesKeys(
  type: ChartType,
  data: Record<string, string | number>[],
  series: ChartSeries[],
  xKey: string,
): boolean {
  if (type === 'pie') return true;
  if (!data.every((row) => xKey in row)) return false;
  return series.some((s) => data.some((row) => typeof row[s.key] === 'number'));
}

export function parseChartSpec(raw: string): ChartSpec | null {
  const json = parseJsonLoose(raw);
  if (!isRecord(json) || typeof json.type !== 'string' || !CHART_TYPES.has(json.type as ChartType)) {
    return null;
  }

  const type = json.type as ChartType;
  const preferredX =
    typeof json.xKey === 'string'
      ? json.xKey
      : typeof json.xAxis === 'string'
        ? json.xAxis
        : 'label';
  const nameKey =
    typeof json.nameKey === 'string'
      ? json.nameKey
      : typeof json.name === 'string'
        ? json.name
        : preferredX;
  const valueKey = typeof json.valueKey === 'string' ? json.valueKey : 'value';

  const data = parseData(json.data);
  if (!data) return null;

  const xKey = inferXKey(data, preferredX);
  const series = parseSeries(json.series, valueKey);
  if (!series) return null;

  if (type === 'pie') {
    const pieNameKey = inferXKey(data, nameKey);
    const hasNames = data.every((row) => pieNameKey in row);
    const hasValues = data.every((row) => typeof row[valueKey] === 'number');
    if (!hasNames || !hasValues) return null;
    return {
      type,
      title: typeof json.title === 'string' ? json.title : undefined,
      xKey,
      nameKey: pieNameKey,
      valueKey,
      series,
      data,
    };
  }

  if (!validateSeriesKeys(type, data, series, xKey)) return null;

  return {
    type,
    title: typeof json.title === 'string' ? json.title : undefined,
    xKey,
    nameKey: inferXKey(data, nameKey),
    valueKey,
    series,
    data,
  };
}
