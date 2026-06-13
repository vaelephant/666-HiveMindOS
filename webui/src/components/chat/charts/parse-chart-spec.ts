import type { ChartSeries, ChartSpec, ChartType } from '@/components/chat/charts/types';

const CHART_TYPES = new Set<ChartType>(['bar', 'line', 'pie']);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseSeries(raw: unknown, valueKey: string): ChartSeries[] | null {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [{ key: valueKey, name: '数值' }];
  }
  const series: ChartSeries[] = [];
  for (const item of raw) {
    if (!isRecord(item) || typeof item.key !== 'string' || typeof item.name !== 'string') {
      return null;
    }
    series.push({
      key: item.key,
      name: item.name,
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
      if (typeof v === 'number' && Number.isFinite(v)) {
        parsed[k] = v;
      } else if (typeof v === 'string') {
        parsed[k] = v;
      } else {
        return null;
      }
    }
    if (Object.keys(parsed).length === 0) return null;
    rows.push(parsed);
  }
  return rows;
}

export function parseChartSpec(raw: string): ChartSpec | null {
  let json: unknown;
  try {
    json = JSON.parse(raw.trim());
  } catch {
    return null;
  }
  if (!isRecord(json) || typeof json.type !== 'string' || !CHART_TYPES.has(json.type as ChartType)) {
    return null;
  }

  const xKey = typeof json.xKey === 'string' ? json.xKey : 'label';
  const nameKey = typeof json.nameKey === 'string' ? json.nameKey : xKey;
  const valueKey = typeof json.valueKey === 'string' ? json.valueKey : 'value';
  const data = parseData(json.data);
  if (!data) return null;

  const series = parseSeries(json.series, valueKey);
  if (!series) return null;

  if (json.type === 'pie') {
    const hasNames = data.every((row) => nameKey in row);
    const hasValues = data.every((row) => typeof row[valueKey] === 'number');
    if (!hasNames || !hasValues) return null;
  }

  return {
    type: json.type as ChartType,
    title: typeof json.title === 'string' ? json.title : undefined,
    xKey,
    nameKey,
    valueKey,
    series,
    data,
  };
}
