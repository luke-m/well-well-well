import { useState, useEffect, useCallback, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchWells } from '../services/overpassService';
import { getCurrentCoordinates } from '../utils/geolocation';
import { GeolocationError } from '../utils/errors';
import type { Feature, Point, FeatureCollection } from 'geojson';
import { Loader2, AlertCircle, Locate } from 'lucide-react';
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

// "You are here" marker: a blue dot, deliberately distinct from the default
// pin so it can't be confused with a data-layer marker (well / spring).
const userLocationIcon = L.divIcon({
  className: '',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: `
    <span style="position: relative; display: block; width: 22px; height: 22px;">
      <span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 22px; height: 22px; border-radius: 9999px; background: rgba(59, 130, 246, 0.65);"></span>
      <span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 14px; height: 14px; border-radius: 9999px; background: rgb(37, 99, 235); border: 2px solid white; box-shadow: 0 1px 2px rgba(0,0,0,0.3);"></span>
    </span>
  `,
});

// Component to handle map events and update bounds
interface MapBoundsHandlerProps {
  onBoundsChange: (bounds: [number, number, number, number]) => void;
  onUserInteraction: () => void;
  /**
   * Ref flipped to `true` while a programmatic `flyTo` is animating so that
   * the `zoomstart` event it emits does NOT clear the user marker. Cleared
   * again on the trailing `moveend`.
   */
  suppressNextZoomClear: MutableRefObject<boolean>;
}

function MapBoundsHandler({
  onBoundsChange,
  onUserInteraction,
  suppressNextZoomClear,
}: MapBoundsHandlerProps) {
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

      // Programmatic flyTo has finished; user-initiated zooms after this
      // point will clear the marker again.
      suppressNextZoomClear.current = false;
    },
    dragstart: () => {
      // Drag is always user-initiated.
      onUserInteraction();
    },
    zoomstart: () => {
      // Skip if we're inside the flyTo animation window.
      if (!suppressNextZoomClear.current) {
        onUserInteraction();
      }
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

  const mapRef = useRef<L.Map | null>(null);
  const suppressNextZoomClear = useRef<boolean>(false);

  const [bounds, setBounds] = useState<[number, number, number, number] | null>(null);
  const [wells, setWells] = useState<FeatureCollection | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

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

  const handleCenterOnMe = useCallback(async () => {
    setError(null);
    setIsLocating(true);
    try {
      const coords = await getCurrentCoordinates();
      setUserLocation(coords);
      const map = mapRef.current;
      if (map) {
        // Suppress the zoomstart that flyTo emits so the marker doesn't
        // vanish before the camera finishes animating in.
        suppressNextZoomClear.current = true;
        map.flyTo([coords.lat, coords.lng], 15);
      }
    } catch (err) {
      if (err instanceof GeolocationError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Could not determine your location.');
      }
      setUserLocation(null);
    } finally {
      setIsLocating(false);
    }
  }, []);

  const handleUserInteraction = useCallback(() => {
    setUserLocation(null);
  }, []);

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
      {/* All overlays in one top-center column so loader / error / action
          pills never overlap each other regardless of viewport. */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex flex-col items-center gap-2">
        {loading && (
          <div className="bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span className="text-sm font-medium text-slate-700">Fetching wells...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-red-700">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        <button
          onClick={handleCenterOnMe}
          disabled={isLocating}
          aria-label="Center on me"
          className={`px-4 py-2 rounded-full shadow-lg font-medium transition-all flex items-center gap-2 ${
            isLocating
              ? 'bg-white/50 text-slate-400 cursor-not-allowed'
              : 'bg-white text-slate-700 hover:bg-slate-50 active:scale-95'
          }`}
        >
          {isLocating ? (
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          ) : (
            <Locate className="w-4 h-4 text-blue-600" />
          )}
          <span className="text-sm sm:text-base">Center on me</span>
        </button>

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
        ref={mapRef}
        className="w-full h-full"
        minZoom={2}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapBoundsHandler
          onBoundsChange={handleBoundsChange}
          onUserInteraction={handleUserInteraction}
          suppressNextZoomClear={suppressNextZoomClear}
        />

        {wells && (
          <GeoJSON
            data={wells}
            onEachFeature={onEachFeature}
          />
        )}

        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={userLocationIcon}
          />
        )}
      </MapContainer>
    </div>
  );
};

export default WellMap;
