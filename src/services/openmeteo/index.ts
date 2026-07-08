// Composition point: the only place the provider meets the global fetch.
// Response satisfies HttpResponse structurally, so no adapter shape is needed.
import { DEFAULT_CONFIG } from './config';
import { createOpenMeteoProvider } from './provider';
import { type MarineDataProvider } from './types';

let provider: MarineDataProvider | null = null;

export function getProvider(): MarineDataProvider {
  if (provider === null) {
    provider = createOpenMeteoProvider(DEFAULT_CONFIG, (url, signal) => fetch(url, { signal }));
  }
  return provider;
}

export { OpenMeteoError } from './provider';
export { DEFAULT_CONFIG } from './config';
export type { MarineDataProvider, HourlyMarineData, HourlyWindData } from './types';
