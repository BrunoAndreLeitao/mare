// Provider contract (docs/OPEN_METEO.md §9). Any absent value is null, never 0 —
// zero is a valid meteorological reading and confusing them corrupts insights.
export interface HourlyMarineData {
  timeUtc: number; // epoch seconds
  waveHeightM: number | null;
  waveDirectionDeg: number | null;
  wavePeriodS: number | null;
  swellHeightM: number | null;
  swellDirectionDeg: number | null;
  swellPeriodS: number | null;
  swellPeakPeriodS: number | null;
  windWaveHeightM: number | null;
  seaLevelMslM: number | null;
  waterTempC: number | null;
}

export interface HourlyWindData {
  timeUtc: number;
  windSpeedKmh: number | null;
  windGustsKmh: number | null;
  windDirectionDeg: number | null;
}

export interface MarineDataProvider {
  fetchDayConditions(lat: number, lon: number, dateUtc: string): Promise<HourlyMarineData[]>;
  fetchDayWind(lat: number, lon: number, dateUtc: string): Promise<HourlyWindData[]>;
}

// Minimal fetch surface the provider needs — injected like RepoDeps, so tests
// feed recorded responses with zero library mocks. The global fetch's Response
// satisfies HttpResponse structurally at the composition point.
export interface HttpResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}
export type FetchFn = (url: string, signal?: AbortSignal) => Promise<HttpResponse>;
