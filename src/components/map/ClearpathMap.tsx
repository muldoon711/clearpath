import React, { useRef, useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import MapLibreGL, { type MapViewRef, type CameraRef } from '@maplibre/maplibre-react-native';
import { useAppSelector, useAppDispatch } from '../../store';
import { updateViewport, setIsFollowingUser } from '../../store/slices/mapSlice';
import { loadVisibleCameras } from '../../store/slices/cameraSlice';
import { selectCamera } from '../../store/slices/cameraSlice';
import CameraLayer from './CameraLayer';
import RouteLayer from './RouteLayer';
import type { ALPRCamera, BoundingBox } from '../../types';

const STYLE_URLS: Record<string, string> = {
  streets: 'https://tiles.openfreemap.org/styles/liberty',
  dark: 'https://tiles.openfreemap.org/styles/positron',
  topo: 'https://tiles.openfreemap.org/styles/fiord-color',
  satellite: 'https://tiles.openfreemap.org/styles/bright',
};

interface ClearpathMapProps {
  onMapReady?: () => void;
}

export default function ClearpathMap({ onMapReady }: ClearpathMapProps) {
  const dispatch = useAppDispatch();
  const mapRef = useRef<MapViewRef>(null);
  const cameraRef = useRef<CameraRef>(null);

  const { center, zoom, bearing, pitch, isFollowingUser, mapStyle, showCameras } = useAppSelector(
    (state) => state.map,
  );
  const { current: route } = useAppSelector((state) => state.route);
  const { visibleCameras } = useAppSelector((state) => state.cameras);

  // Fit map to route bounds whenever a new route is loaded
  useEffect(() => {
    if (!route || !cameraRef.current) return;
    const lons = route.geometry.map(([lon]) => lon);
    const lats = route.geometry.map(([, lat]) => lat);
    cameraRef.current.fitBounds(
      [Math.max(...lons), Math.max(...lats)],
      [Math.min(...lons), Math.min(...lats)],
      [160, 60, 240, 60],
      1000,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.id]);

  // Keep camera centered on user when following
  useEffect(() => {
    if (isFollowingUser && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: [center.longitude, center.latitude],
        zoomLevel: zoom,
        heading: bearing,
        pitch,
        animationMode: 'flyTo',
        animationDuration: 300,
      });
    }
  }, [center, zoom, bearing, pitch, isFollowingUser]);

  type RegionFeature = {
    properties: {
      visibleBounds: number[][];
      zoomLevel: number;
      heading: number;
      pitch: number;
      isUserInteraction: boolean;
    };
  };

  const handleRegionDidChange = useCallback(
    async (feature: RegionFeature) => {
      const {
        visibleBounds,
        zoomLevel,
        heading,
        pitch: newPitch,
        isUserInteraction,
      } = feature.properties;

      if (isUserInteraction) {
        dispatch(setIsFollowingUser(false));
      }

      const ne = visibleBounds[0] ?? [];
      const sw = visibleBounds[1] ?? [];
      const maxLng = ne[0] ?? 0;
      const maxLat = ne[1] ?? 0;
      const minLng = sw[0] ?? 0;
      const minLat = sw[1] ?? 0;
      const bounds: BoundingBox = { minLat, minLng, maxLat, maxLng };

      if (zoomLevel >= 12 && showCameras) {
        dispatch(loadVisibleCameras(bounds));
      }

      const center = await mapRef.current?.getCenter();
      if (center) {
        dispatch(
          updateViewport({
            center: { latitude: center[1], longitude: center[0] },
            zoom: zoomLevel,
            bearing: heading,
            pitch: newPitch,
          }),
        );
      }
    },
    [dispatch, showCameras],
  );

  const handleCameraPress = useCallback(
    (camera: ALPRCamera) => {
      dispatch(selectCamera(camera.id));
    },
    [dispatch],
  );

  return (
    <View style={styles.container}>
      <MapLibreGL.MapView
        ref={mapRef}
        style={styles.map}
        mapStyle={STYLE_URLS[mapStyle] ?? STYLE_URLS.streets}
        compassEnabled
        compassViewPosition={3}
        logoEnabled={false}
        attributionEnabled={false}
        onRegionDidChange={handleRegionDidChange}
        onDidFinishLoadingMap={onMapReady}
      >
        <MapLibreGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [center.longitude, center.latitude],
            zoomLevel: zoom,
          }}
        />

        <MapLibreGL.UserLocation
          visible
          renderMode="native"
          androidRenderMode="gps"
          showsUserHeadingIndicator
        />

        {route && <RouteLayer route={route} />}

        {showCameras && visibleCameras.length > 0 && (
          <CameraLayer cameras={visibleCameras} onCameraPress={handleCameraPress} />
        )}
      </MapLibreGL.MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});
