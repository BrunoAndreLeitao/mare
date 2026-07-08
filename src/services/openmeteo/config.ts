// Host and apiKey are configurable so the Fase 5 commercial migration is a
// config change, not a code change: swap the hosts to customer-*.open-meteo.com
// and set apiKey (docs/OPEN_METEO.md §8). Free tier: no key.
export interface OpenMeteoConfig {
  marineHost: string;
  forecastHost: string;
  apiKey?: string;
  /** Per-request timeout; a hung fetch becomes a temporary failure. */
  timeoutMs: number;
}

export const DEFAULT_CONFIG: OpenMeteoConfig = {
  marineHost: 'https://marine-api.open-meteo.com',
  forecastHost: 'https://api.open-meteo.com',
  timeoutMs: 10_000,
};
