import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import WellMap from '../WellMap';
import { fetchWells } from '../../services/overpassService';

// Mock the service
vi.mock('../../services/overpassService', () => ({
  fetchWells: vi.fn(),
}));

// Mock Leaflet and its dependencies
// Note: Leaflet is difficult to test in JSDOM, so we mock the main parts.
vi.mock('react-leaflet', () => {
  const mockMap = {
    getBounds: vi.fn().mockReturnValue({
      getSouthWest: () => ({ lat: 51.5, lng: -0.1 }),
      getNorthEast: () => ({ lat: 51.6, lng: -0.0 }),
    }),
    getCenter: vi.fn().mockReturnValue({ lat: 51.5, lng: -0.1 }),
    getZoom: vi.fn().mockReturnValue(13),
    on: vi.fn(),
  };

  return {
    MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map-container">{children}</div>,
    TileLayer: () => <div data-testid="tile-layer" />,
    GeoJSON: ({ data }: { data: any }) => <div data-testid="geojson">{JSON.stringify(data)}</div>,
    useMapEvents: () => mockMap,
  };
});

describe('WellMap Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders the map container', () => {
    render(<WellMap />);
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('shows loading state when fetching wells', async () => {
    (fetchWells as any).mockReturnValue(new Promise((resolve) => {
      // Never resolve to keep it in loading state
    }));

    render(<WellMap />);

    // Trigger search
    const searchButton = screen.getByRole('button', { name: /search this area/i });
    fireEvent.click(searchButton);

    expect(screen.getByText(/fetching wells.../i)).toBeInTheDocument();
  });

  it('shows error state when fetch fails', async () => {
    (fetchWells as any).mockRejectedValue(new Error('Failed to fetch wells'));

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

    (fetchWells as any).mockResolvedValue(mockGeoJSON);

    render(<WellMap />);

    const searchButton = screen.getByRole('button', { name: /search this area/i });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByTestId('geojson')).toBeInTheDocument();
      expect(screen.getByTestId('geojson')).toHaveTextContent('Test Well');
    });
  });
});