import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCurrentCoordinates } from '../geolocation';
import { GeolocationError } from '../errors';

type PositionCallback = (pos: { coords: { latitude: number; longitude: number } }) => void;
type ErrorCallback = (err: { code: number; message: string }) => void;

function installGeolocation(
  handler: (success: PositionCallback, error: ErrorCallback) => void,
) {
  vi.stubGlobal('navigator', {
    geolocation: {
      getCurrentPosition: vi.fn((success: PositionCallback, error: ErrorCallback) => {
        handler(success, error);
      }),
    },
  });
}

describe('getCurrentCoordinates', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves with latitude/longitude on success', async () => {
    installGeolocation((success) => {
      success({ coords: { latitude: 51.5, longitude: -0.05 } });
    });

    const coords = await getCurrentCoordinates();

    expect(coords).toEqual({ lat: 51.5, lng: -0.05 });
  });

  it('rejects with GeolocationError PERMISSION_DENIED (code 1)', async () => {
    installGeolocation((_success, error) => {
      error({ code: 1, message: 'denied' });
    });

    await expect(getCurrentCoordinates()).rejects.toBeInstanceOf(GeolocationError);

    try {
      await getCurrentCoordinates();
    } catch (err) {
      expect((err as GeolocationError).code).toBe('PERMISSION_DENIED');
      expect((err as GeolocationError).message).toBe('Location permission denied.');
    }
  });

  it('rejects with GeolocationError POSITION_UNAVAILABLE (code 2)', async () => {
    installGeolocation((_success, error) => {
      error({ code: 2, message: 'unavailable' });
    });

    try {
      await getCurrentCoordinates();
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as GeolocationError).code).toBe('POSITION_UNAVAILABLE');
      expect((err as GeolocationError).message).toBe('Could not determine your location.');
    }
  });

  it('rejects with GeolocationError TIMEOUT (code 3)', async () => {
    installGeolocation((_success, error) => {
      error({ code: 3, message: 'timeout' });
    });

    try {
      await getCurrentCoordinates();
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as GeolocationError).code).toBe('TIMEOUT');
      expect((err as GeolocationError).message).toBe('Location request timed out.');
    }
  });

  it('rejects with GeolocationError UNSUPPORTED when navigator.geolocation is missing', async () => {
    vi.stubGlobal('navigator', {});

    try {
      await getCurrentCoordinates();
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as GeolocationError).code).toBe('UNSUPPORTED');
      expect((err as GeolocationError).message).toBe(
        'Geolocation is not available in this browser.',
      );
    }
  });

  it('passes merged options through to getCurrentPosition', () => {
    const calls: unknown[] = [];
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: vi.fn((_s: unknown, _e: unknown, opts: unknown) => {
          calls.push(opts);
        }),
      },
    });

    // Don't await — the stub never invokes either callback, so the returned
    // promise is intentionally pending. We only want to inspect the options
    // that were forwarded to the stub.
    void getCurrentCoordinates({ enableHighAccuracy: true, timeout: 5000, maximumAge: 0 });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ enableHighAccuracy: true, timeout: 5000, maximumAge: 0 });
  });
});
