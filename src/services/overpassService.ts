import type { Feature, Point, FeatureCollection } from "geojson";
import { OverpassError } from "../utils/errors";

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

interface OverpassElement {
    type: 'node' | 'way' | 'relation';
    id: number;
    lat?: number;
    lon?: number;
    tags?: Record<string, string>;
}

interface OverpassResponse {
    elements: OverpassElement[];
}

/**
 * Fetches well data from the Overpass API based on a bounding box.
 * @param bounds - [south, west, north, east]
 * @returns GeoJSON feature collection
 */
export async function fetchWells(bounds: [number, number, number, number]) {
    const [south, west, north, east] = bounds;

    // Overpass QL query
    // We search for nodes, ways, and relations with man_made=well within the bbox
    const query = `
    [out:json][timeout:225];
    (
      node["amenity"="drinking_water"](${south},${west},${north},${east});
      node["natural"="spring"](${south},${west},${north},${east});
    );
    out body;
    >;
    out skel qt;
  `;

    const response = await fetch(OVERPASS_API_URL, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
        throw new OverpassError('Failed to fetch data from Overpass API');
    }

    const data: OverpassResponse = await response.json();
    return convertToGeoJSON(data);
}

/**
 * Converts Overpass JSON response to GeoJSON format.
 * @param data - Overpass JSON response
 * @returns GeoJSON FeatureCollection
 */
function convertToGeoJSON(data: OverpassResponse): FeatureCollection {
    const features: Feature<Point>[] = [];

    // Process nodes
    if (data.elements) {
        data.elements.forEach((element) => {
            if (element.type === 'node' && element.lat !== undefined && element.lon !== undefined) {
                const properties = { ...element.tags };
                features.push({
                    id: element.id,
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [element.lon, element.lat],
                    },
                    properties,
                });
            }
            // For simplicity in this first version, we'll focus on nodes.
            // Ways and relations would require more complex geometry reconstruction.
        });
    }

    return {
        type: 'FeatureCollection',
        features,
    };
}