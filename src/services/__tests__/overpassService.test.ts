import type { Point } from 'geojson';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWells } from '../overpassService';

describe('overpassService', () => {
  const mockBounds: [number, number, number, number] = [51.5, -0.1, 51.6, -0.0];

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch wells successfully and return GeoJSON', async () => {
    const mockResponse = {
      elements: [
        {
          type: 'node',
          id: 123,
          lat: 51.55,
          lon: -0.05,
          tags: { name: 'Test Well' },
        },
      ],
    };

    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await fetchWells(mockBounds);

    expect(fetch).toHaveBeenCalled();
    expect(result.type).toBe('FeatureCollection');
    expect(result.features).toHaveLength(1);
    expect(result.features[0].properties?.name).toBe('Test Well');
    // `convertToGeoJSON` only ever produces `Point` geometries, but the
    // `FeatureCollection` return type exposes `Geometry` (a union that
    // includes `GeometryCollection`, which has no `coordinates`), so narrow
    // here for the assertion.
    expect((result.features[0].geometry as Point).coordinates).toEqual([-0.05, 51.55]);
  });

  it('should throw an error when the fetch fails', async () => {
    (fetch as any).mockResolvedValue({
      ok: false,
    });

    await expect(fetchWells(mockBounds)).rejects.toThrow('Failed to fetch data from Overpass API');
  });

  it('should handle empty response elements', async () => {
    const mockResponse = {
      elements: [],
    };

    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await fetchWells(mockBounds);

    expect(result.type).toBe('FeatureCollection');
    expect(result.features).toHaveLength(0);
  });

  it('should ignore non-node elements in conversion', async () => {
    const mockResponse = {
      elements: [
        {
          type: 'way',
          id: 456,
          // ways don't have lat/lon in this simple implementation
        },
      ],
    };

    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await fetchWells(mockBounds);

    expect(result.features).toHaveLength(0);
  });
});