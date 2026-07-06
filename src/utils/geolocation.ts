import { GeolocationError } from './errors';

export interface Coords {
  lat: number;
  lng: number;
}

export interface GetCoordinatesOptions {
  /** Battery-friendly default: false. */
  enableHighAccuracy?: boolean;
  /** Milliseconds before the browser gives up. */
  timeout?: number;
  /** Reuse a cached fix if it's no older than this. */
  maximumAge?: number;
}

const DEFAULTS: Required<GetCoordinatesOptions> = {
  enableHighAccuracy: false,
  timeout: 10_000,
  maximumAge: 60_000,
};

const ERROR_MESSAGES: Record<1 | 2 | 3, string> = {
  1: 'Location permission denied.',
  2: 'Could not determine your location.',
  3: 'Location request timed out.',
};

const ERROR_CODES: Record<1 | 2 | 3, 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT'> = {
  1: 'PERMISSION_DENIED',
  2: 'POSITION_UNAVAILABLE',
  3: 'TIMEOUT',
};

/**
 * Single-shot `navigator.geolocation.getCurrentPosition` wrapper.
 *
 * Resolves to `{ lat, lng }` on success. Rejects with a typed
 * `GeolocationError` covering denied / unavailable / timeout,
 * plus a synthetic `UNSUPPORTED` error if the API is missing.
 */
export function getCurrentCoordinates(
  options: GetCoordinatesOptions = {},
): Promise<Coords> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.reject(
      new GeolocationError(
        'Geolocation is not available in this browser.',
        'UNSUPPORTED',
      ),
    );
  }

  return new Promise<Coords>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (err) => {
        // PositionError codes: 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
        if (err && (err.code === 1 || err.code === 2 || err.code === 3)) {
          reject(
            new GeolocationError(ERROR_MESSAGES[err.code], ERROR_CODES[err.code]),
          );
        } else {
          reject(
            new GeolocationError(
              err?.message ?? 'Could not determine your location.',
              'POSITION_UNAVAILABLE',
            ),
          );
        }
      },
      { ...DEFAULTS, ...options },
    );
  });
}
