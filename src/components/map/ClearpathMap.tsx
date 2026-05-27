import React, { useRef, useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
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
  const mapRef = useRef<MapLibreGL.MapView>(null);
  const cameraRef = useRef<MapLibreGL.Camera>(null);

  const { center, zoom, bearing, pitch, isFollowingUser, mapStyle, showCameras } =
    useAppSelector(state => state.map);
  const { current: route } = useAppSelector(state => state.route);
  const { visibleCameras } = useAppSelector(state => state.cameras);

  // Keep camera centered on user when following
  useEffect(() => {
    if (isFollowingUser && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: [center.longitude, center.latitude],
        zoomLevel: zoom,
        bearing,
        pitch,
        animationMode: 'flyTo',
        animationDuration: 300,
      });
    }
  }, [center, zoom, bearing, pitch, isFollowingUser]);

  const handleRegionDidChange = useCallback(
    async (feature: { properties: { visibleBounds: [[number, number], [number, number]]; zoomLevel: number; heading: number; pitch: number; isUserInteraction: boolean } }) => {
      const { visibleBounds, zoomLevel, heading, pitch: newPitch, isUserInteraction } = feature.properties;

      if (isUserInteraction) {
        dispatch(setIsFollowingUser(false));
      }

      const [[maxLng, maxLat], [minLng, minLat]] = visibleBounds;
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
        styleURL={STYLE_URLS[mapStyle] ?? STYLE_URLS.streets}
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
