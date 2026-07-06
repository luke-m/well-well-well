import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import WellMap from '../WellMap';
import { fetchWells } from '../../services/overpassService';

// Shared mock state accessible from inside the vi.mock factories below.
// vi.hoisted guarantees this exists before mocks are resolved.
const { mockHandlers, mockMap } = vi.hoisted(() => {
  const mockHandlers: Record<string, (...args: unknown[]) => void> = {};
  const mockMap = {
    getBounds: vi.fn().mockReturnValue({
      getSouthWest: () => ({ lat: 51.5, lng: -0.1 }),
      getNorthEast: () => ({ lat: 51.6, lng: -0.0 }),
    }),
    getCenter: vi.fn().mockReturnValue({ lat: 51.5, lng: -0.1 }),
    getZoom: vi.fn().mockReturnValue(13),
    flyTo: vi.fn(),
    on: vi.fn(),
  };
  return { mockHandlers, mockMap };
});

// Mock the service
vi.mock('../../services/overpassService', () => ({
  fetchWells: vi.fn(),
}));

// Mock Leaflet and its dependencies.
// Note: Leaflet is difficult to test in JSDOM, so we mock the main parts.
vi.mock('react-leaflet', () => {
  return {
    MapContainer: ({
      children,
      ref,
    }: {
      children: React.ReactNode;
      ref?: React.MutableRefObject<unknown>;
    }) => {
      if (ref) {
        ref.current = mockMap;
      }
      return <div data-testid="map-container">{children}</div>;
    },
    TileLayer: () => <div data-testid="tile-layer" />,
    GeoJSON: ({ data }: { data: unknown }) => (
      <div data-testid="geojson">{JSON.stringify(data)}</div>
    ),
    Marker: ({ icon, position }: { icon?: unknown; position?: [number, number] }) =>
      icon ? (
        <div
          data-testid="user-marker"
          data-position={JSON.stringify(position)}
        />
      ) : null,
    useMapEvents: (handlers: Record<string, (...args: unknown[]) => void>) => {
      for (const [name, fn] of Object.entries(handlers)) {
        if (typeof fn === 'function') {
          mockHandlers[name] = fn;
        }
      }
      return mockMap;
    },
  };
});

describe('WellMap Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    for (const k of Object.keys(mockHandlers)) {
      delete mockHandlers[k];
    }
    vi.unstubAllGlobals();
  });

  it('renders the map container', () => {
    render(<WellMap />);
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('shows loading state when fetching wells', async () => {
    (fetchWells as unknown as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {
      // Never resolve to keep it in loading state
    }));

    render(<WellMap />);

    // Trigger search
    const searchButton = screen.getByRole('button', { name: /search this area/i });
    fireEvent.click(searchButton);

    expect(screen.getByText(/fetching wells.../i)).toBeInTheDocument();
  });

  it('shows error state when fetch fails', async () => {
    (fetchWells as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Failed to fetch wells'));

    render(<WellMap />);

    const searchButton = screen.getByRole('button', { name: /search this area/i });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText(/failed to fetch wells/i)).toBeInTheDocument();
    });
  });

  it('renders wells when fetch is successful', async () => {
    const mockGeoJSON = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 1,
          properties: { name: 'Test Well', man_made: 'well' },
          geometry: { type: 'Point', coordinates: [0, 0] },
        },
      ],
    };

    (fetchWells as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockGeoJSON);

    render(<WellMap />);

    const searchButton = screen.getByRole('button', { name: /search this area/i });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByTestId('geojson')).toBeInTheDocument();
      expect(screen.getByTestId('geojson')).toHaveTextContent('Test Well');
    });
  });

  describe('Center on me', () => {
    function stubNavigatorGeolocation(
      handler: (success: (pos: { coords: { latitude: number; longitude: number } }) => void,
                error: (err: { code: number; message: string }) => void) => void,
    ) {
      const getCurrentPosition = vi.fn(
        (
          success: (pos: { coords: { latitude: number; longitude: number } }) => void,
          error: (err: { code: number; message: string }) => void,
        ) => {
          handler(success, error);
        },
      );
      vi.stubGlobal('navigator', {
        geolocation: { getCurrentPosition },
      });
      return getCurrentPosition;
    }

    it('renders a "Center on me" button', () => {
      render(<WellMap />);
      expect(
        screen.getByRole('button', { name: /center on me/i }),
      ).toBeInTheDocument();
    });

    it('on click, triggers geolocation and renders the user marker on success', async () => {
      const getCurrentPosition = stubNavigatorGeolocation((success) => {
        success({ coords: { latitude: 51.5, longitude: -0.05 } });
      });

      render(<WellMap />);
      fireEvent.click(screen.getByRole('button', { name: /center on me/i }));

      await waitFor(() => {
        expect(screen.getByTestId('user-marker')).toBeInTheDocument();
        expect(screen.getByTestId('user-marker')).toHaveAttribute(
          'data-position',
          JSON.stringify([51.5, -0.05]),
        );
        expect(mockMap.flyTo).toHaveBeenCalledWith([51.5, -0.05], 15);
      });
      expect(getCurrentPosition).toHaveBeenCalled();
    });

    it('shows an inline error pill when geolocation permission is denied', async () => {
      stubNavigatorGeolocation((_success, error) => {
        error({ code: 1, message: 'denied' });
      });

      render(<WellMap />);
      fireEvent.click(screen.getByRole('button', { name: /center on me/i }));

      await waitFor(() => {
        expect(screen.getByText(/location permission denied/i)).toBeInTheDocument();
      });
      expect(screen.queryByTestId('user-marker')).not.toBeInTheDocument();
    });

    it('clears the user marker on user-initiated dragstart', async () => {
      stubNavigatorGeolocation((success) => {
        success({ coords: { latitude: 51.5, longitude: -0.05 } });
      });

      render(<WellMap />);
      fireEvent.click(screen.getByRole('button', { name: /center on me/i }));

      await waitFor(() => screen.getByTestId('user-marker'));
      mockHandlers.dragstart?.();

      await waitFor(() =>
        expect(screen.queryByTestId('user-marker')).not.toBeInTheDocument(),
      );
    });

    it('does NOT clear the user marker on a programmatic zoom (flyTo window)', async () => {
      stubNavigatorGeolocation((success) => {
        success({ coords: { latitude: 51.5, longitude: -0.05 } });
      });

      render(<WellMap />);
      fireEvent.click(screen.getByRole('button', { name: /center on me/i }));

      await waitFor(() => screen.getByTestId('user-marker'));

      // The handler that fired for flyTo zoomstart should NOT clear the marker.
      mockHandlers.zoomstart?.();

      expect(screen.queryByTestId('user-marker')).toBeInTheDocument();
    });
  });
});
