'use client';
// ⚠️ This component is loaded ONLY on the client (dynamic import with ssr: false)
// because Leaflet requires window/document.

import React, { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

interface GeoJSONGeometry {
  type: string;
  coordinates: unknown;
}

interface FeatureDoc {
  _id: string;
  name: string;
  featureType: string;
  geometry: GeoJSONGeometry;
  properties: Record<string, unknown>;
  color: string;
  active: boolean;
}

interface Props {
  features: FeatureDoc[];
  selectedFeatureId: string | null;
  onSelectFeature: (id: string | null) => void;
}

// Fix Leaflet default icon path issue with webpack
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Default center: Takhli, Nakhon Sawan
const DEFAULT_CENTER: [number, number] = [15.26, 100.34];
const DEFAULT_ZOOM = 11;

export default function GeoJSONMapPreview({ features, selectedFeatureId, onSelectFeature }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<Map<string, L.Layer>>(new Map());

  // ── Init map ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Sync features ───────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentIds = new Set(features.map(f => f._id));

    // Remove layers for features no longer in list
    layersRef.current.forEach((layer, id) => {
      if (!currentIds.has(id)) {
        map.removeLayer(layer);
        layersRef.current.delete(id);
      }
    });

    // Add / update layers
    features.forEach((feat) => {
      const geojsonObj = {
        type: 'Feature' as const,
        geometry: feat.geometry as GeoJSON.Geometry,
        properties: { ...feat.properties, _id: feat._id, name: feat.name },
      };

      const isSelected = feat._id === selectedFeatureId;
      const color = feat.color || '#3B82F6';

      const layerOptions = {
        style: () => ({
          color,
          weight: isSelected ? 3 : 1.5,
          opacity: isSelected ? 1 : 0.8,
          fillColor: color,
          fillOpacity: isSelected ? 0.35 : 0.15,
        }),
        pointToLayer: (_: unknown, latlng: L.LatLng) =>
          L.circleMarker(latlng, {
            radius: 8,
            color,
            weight: isSelected ? 3 : 1.5,
            fillColor: color,
            fillOpacity: 0.5,
          }),
        onEachFeature: (_: unknown, layer: L.Layer) => {
          layer.bindTooltip(feat.name, { sticky: true });
          layer.on('click', () => onSelectFeature(feat._id));
        },
      };

      if (layersRef.current.has(feat._id)) {
        // Replace with updated styling
        const old = layersRef.current.get(feat._id)!;
        map.removeLayer(old);
      }

      try {
        const layer = L.geoJSON(geojsonObj as GeoJSON.GeoJsonObject, layerOptions);
        layer.addTo(map);
        layersRef.current.set(feat._id, layer);
      } catch {
        // skip invalid geometry silently
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features, selectedFeatureId]);

  // ── Pan to selected ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedFeatureId) return;
    const layer = layersRef.current.get(selectedFeatureId);
    if (!layer) return;
    try {
      const bounds = (layer as L.GeoJSON).getBounds?.();
      if (bounds && bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }
    } catch {
      // ignore
    }
  }, [selectedFeatureId]);

  return (
    <div className="relative w-full h-full min-h-[320px]">
      <div ref={mapContainerRef} className="absolute inset-0 rounded-2xl z-0" />
      {features.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
          <span className="text-4xl opacity-30">🗺️</span>
          <p className="text-sm text-gray-400 mt-2">ยังไม่มี Feature ที่ Active</p>
        </div>
      )}
    </div>
  );
}
