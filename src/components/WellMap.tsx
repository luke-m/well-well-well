import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchWells } from '../services/overpassService';
import type { Feature, Point, FeatureCollection } from 'geojson';
import { Loader2, AlertCircle } from 'lucide-react';
import L from 'leaflet';

// Fix for default marker icons in Leaflet with React
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Component to handle map events and update bounds
interface MapBoundsHandlerProps {
  onBoundsChange: (bounds: [number, number, number, number]) => void;
}

function MapBoundsHandler({ onBoundsChange }: MapBoundsHandlerProps) {
  const map = useMapEvents({
    moveend: () => {
      // Save center and zoom to localStorage
      const center = map.getCenter();
      const zoom = map.getZoom();
      localStorage.setItem('mapConfig', JSON.stringify({
        center: [center.lat, center.lng],
        zoom: zoom
      }));

      const bounds = map.getBounds();
      const southWest = bounds.getSouthWest();
      const northEast = bounds.getNorthEast();
      onBoundsChange([
        southWest.lat,
        southWest.lng,
        northEast.lat,
        northEast.lng,
      ]);
    },
  });

  // Set initial bounds on mount
  useEffect(() => {
    const bounds = map.getBounds();
    const southWest = bounds.getSouthWest();
    const northEast = bounds.getNorthEast();
    onBoundsChange([
      southWest.lat,
      southWest.lng,
      northEast.lat,
      northEast.lng,
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount to avoid loops

  return null;
}

const WellMap = () => {
  // Load initial map view from localStorage
  interface MapConfig {
    center: [number, number];
    zoom: number;
  }

  const [initialConfig] = useState<MapConfig>(() => {
    const savedConfig = localStorage.getItem('mapConfig');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        return {
          center: parsed.center,
          zoom: parsed.zoom
        };
      } catch (e) {
        console.error('Failed to parse mapConfig from localStorage', e);
      }
    }
    return { center: [51.505, -0.09], zoom: 13 };
  });

  const [bounds, setBounds] = useState<[number, number, number, number] | null>(null);
  const [wells, setWells] = useState<FeatureCollection | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadWells = useCallback(async (currentBounds: [number, number, number, number]) => {
    if (!currentBounds) return;

    setLoading(true);
    setError(null);
    try {
      const data = await fetchWells(currentBounds);
      setWells(data);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load wells');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleBoundsChange = useCallback((newBounds: [number, number, number, number]) => {
    // Only update the bounds state, don't trigger the API call automatically
    setBounds(newBounds);
  }, []);

  const handleSearch = useCallback(async () => {
    if (bounds) {
      await loadWells(bounds);
    }
  }, [bounds, loadWells]);

  const onEachFeature = useCallback((feature: Feature<Point>, layer: L.Layer) => {
    if (feature.properties) {
      const properties = feature.properties;
      let popupContent = '<div class="p-2">';
      if (properties.name) popupContent += `<strong class="font-bold">Name:</strong> ${properties.name}<br/>`;
      if (properties.man_made) popupContent += `<strong class="font-bold">Type:</strong> ${properties.man_made}<br/>`;
      popupContent += `<a href="https://www.openstreetmap.org/node/${feature.id}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline">Link to OSM</a>`;
      popupContent += '</div>';
      layer.bindPopup(popupContent);
    }
  }, []);

  return (
    <div className="relative w-full h-full min-h-[500px] bg-slate-100">
      {loading && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          <span className="text-sm font-medium text-slate-700">Fetching wells...</span>
        </div>
      )}

      {error && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-red-50 border border-red-200 px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Search button overlay */}
      <div className="absolute top-4 sm:top-20 left-1/2 transform -translate-x-1/2 z-[1000]">
        <button
          onClick={handleSearch}
          disabled={loading || !bounds}
          className={`px-4 py-2 rounded-full shadow-lg font-medium transition-all flex items-center gap-2 ${loading || !bounds
            ? 'bg-white/50 text-slate-400 cursor-not-allowed'
            : 'bg-white text-blue-600 hover:bg-blue-50 active:scale-95'
            }`}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-blue-600" />
          )}
          <span className="text-sm sm:text-base">Search this area</span>
        </button>
      </div>

      <MapContainer
        center={initialConfig.center}
        zoom={initialConfig.zoom}
        className="w-full h-full"
        minZoom={2}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapBoundsHandler onBoundsChange={handleBoundsChange} />

        {wells && (
          <GeoJSON
            data={wells}
            onEachFeature={onEachFeature}
          />
        )}
      </MapContainer>
    </div>
  );
};

export default WellMap;