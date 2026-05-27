import React, { useMemo } from 'react';
import MapLibreGL from '@maplibre/maplibre-react-native';
import type { ALPRCamera } from '../../types';

interface CameraLayerProps {
  cameras: ALPRCamera[];
  onCameraPress?: (camera: ALPRCamera) => void;
}

const VENDOR_COLORS: Record<string, string> = {
  flock_safety: '#FF3B30',
  vigilant: '#FF9500',
  motorola: '#FFCC00',
  unknown: '#8E8E93',
};

export default function CameraLayer({ cameras, onCameraPress }: CameraLayerProps) {
  const geojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: cameras.map(camera => ({
        type: 'Feature' as const,
        id: camera.id,
        geometry: {
          type: 'Point' as const,
          coordinates: [camera.location.longitude, camera.location.latitude],
        },
        properties: {
          id: camera.id,
          vendor: camera.vendor,
          status: camera.status,
          color: VENDOR_COLORS[camera.vendor] ?? VENDOR_COLORS.unknown,
        },
      })),
    }),
    [cameras],
  );

  const handlePress = (event: { features: Array<{ properties: { id: string } }> }) => {
    if (!onCameraPress) return;
    const feature = event.features[0];
    if (!feature) return;
    const camera = cameras.find(c => c.id === feature.properties.id);
    if (camera) onCameraPress(camera);
  };

  return (
    <MapLibreGL.ShapeSource id="cameras" shape={geojson} onPress={handlePress} tolerance={5}>
      {/* Avoidance radius circle */}
      <MapLibreGL.CircleLayer
        id="camera-radius"
        style={{
          circleRadius: ['get', 'radius'] as unknown as number,
          circleColor: ['get', 'color'] as unknown as string,
          circleOpacity: 0.12,
          circleStrokeColor: ['get', 'color'] as unknown as string,
          circleStrokeWidth: 1,
          circleStrokeOpacity: 0.4,
          circlePitchAlignment: 'map',
        }}
        filter={['==', ['get', 'status'], 'active']}
      />
      {/* Camera icon dot */}
      <MapLibreGL.CircleLayer
        id="camera-dot"
        aboveLayerID="camera-radius"
        style={{
          circleRadius: 6,
          circleColor: ['get', 'color'] as unknown as string,
          circleStrokeColor: '#FFFFFF',
          circleStrokeWidth: 2,
          circlePitchAlignment: 'viewport',
        }}
      />
    </MapLibreGL.ShapeSource>
  );
}
