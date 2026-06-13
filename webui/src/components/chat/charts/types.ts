export type ChartType = 'bar' | 'line' | 'pie';

export type ChartSeries = {
  key: string;
  name: string;
  color?: string;
};

export type ChartSpec = {
  type: ChartType;
  title?: string;
  xKey: string;
  nameKey: string;
  valueKey: string;
  series: ChartSeries[];
  data: Record<string, string | number>[];
};
