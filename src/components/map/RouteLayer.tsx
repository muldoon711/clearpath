import React, { useMemo } from 'react';
import MapLibreGL from '@maplibre/maplibre-react-native';
import type { Route } from '../../types';

interface RouteLayerProps {
  route: Route;
}

export default function RouteLayer({ route }: RouteLayerProps) {
  const routeGeoJSON = useMemo(
    () => ({
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: route.geometry,
      },
      properties: {},
    }),
    [route.geometry],
  );

  const originGeoJSON = useMemo(
    () => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [route.origin.longitude, route.origin.latitude],
      },
      properties: { type: 'origin' },
    }),
    [route.origin],
  );

  const destinationGeoJSON = useMemo(
    () => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [route.destination.longitude, route.destination.latitude],
      },
      properties: { type: 'destination' },
    }),
    [route.destination],
  );

  return (
    <>
      {/* Route casing (outline) */}
      <MapLibreGL.ShapeSource id="route-source" shape={routeGeoJSON}>
        <MapLibreGL.LineLayer
          id="route-casing"
          style={{
            lineColor: '#FFFFFF',
            lineWidth: 10,
            lineCap: 'round',
            lineJoin: 'round',
          }}
          belowLayerID="route-line"
        />
        <MapLibreGL.LineLayer
          id="route-line"
          style={{
            lineColor: '#3D7BFF',
            lineWidth: 6,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      </MapLibreGL.ShapeSource>

      {/* Origin pin */}
      <MapLibreGL.ShapeSource id="route-origin" shape={originGeoJSON}>
        <MapLibreGL.CircleLayer
          id="origin-dot"
          style={{
            circleRadius: 8,
            circleColor: '#3D7BFF',
            circleStrokeColor: '#FFFFFF',
            circleStrokeWidth: 3,
          }}
        />
      </MapLibreGL.ShapeSource>

      {/* Destination pin */}
      <MapLibreGL.ShapeSource id="route-destination" shape={destinationGeoJSON}>
        <MapLibreGL.CircleLayer
          id="destination-dot"
          style={{
            circleRadius: 10,
            circleColor: '#FF3B30',
            circleStrokeColor: '#FFFFFF',
            circleStrokeWidth: 3,
          }}
        />
      </MapLibreGL.ShapeSource>
    </>
  );
}
