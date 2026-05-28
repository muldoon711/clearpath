import React, { useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert } from 'react-native';
import { useAppDispatch, useAppSelector } from '../store';
import { setCenter, setIsFollowingUser } from '../store/slices/mapSlice';
import { calculateRoute, setDestination } from '../store/slices/routeSlice';
import { syncCameras } from '../store/slices/cameraSlice';
import { updateNavigation } from '../store/slices/routeSlice';
import ClearpathMap from '../components/map/ClearpathMap';
import TurnByTurn from '../components/navigation/TurnByTurn';
import SearchBar from '../components/search/SearchBar';
import LocationService from '../services/LocationService';
import CarPlayService from '../services/CarPlayService';
import AndroidAutoService from '../services/AndroidAutoService';
import DeflockSync from '../services/DeflockSync';
import { haversineDistance } from '../utils/geo';
import type { SearchResult, LatLng } from '../types';

export default function MapScreen() {
  const dispatch = useAppDispatch();
  const { travelMode, syncIntervalMinutes } = useAppSelector((s) => s.settings);
  const { current: route, navigation: navState } = useAppSelector((s) => s.route);
  const syncChecked = useRef(false);

  // Start location tracking on mount
  useEffect(() => {
    const locationService = LocationService.getInstance();

    locationService.requestPermission().then((granted) => {
      if (!granted) {
        Alert.alert(
          'Location Permission',
          'ClearPath needs location access to navigate. Please enable it in Settings.',
        );
        return;
      }

      locationService.startTracking({
        distanceFilter: 5,
        onLocation: (location: LatLng, heading: number, speed: number) => {
          dispatch(setCenter(location));

          // Update navigation if a route is active
          if (route && navState) {
            const currentStep = route.steps[navState.currentStepIndex];
            if (!currentStep) return;

            const distToStep = haversineDistance(location, currentStep.location);
            let stepIndex = navState.currentStepIndex;

            // Advance to next step when close enough
            if (distToStep < 15 && stepIndex < route.steps.length - 1) {
              stepIndex += 1;
            }

            const passed = route.steps.slice(0, stepIndex).reduce((sum, s) => sum + s.distance, 0);
            const remaining = route.totalDistance - passed;
            const elapsedRatio = passed / (route.totalDistance || 1);
            const remainingDuration = route.totalDuration * (1 - elapsedRatio);

            dispatch(
              updateNavigation({
                currentStepIndex: stepIndex,
                distanceToNextManeuver: distToStep,
                remainingDistance: remaining,
                remainingDuration,
                isOffRoute: distToStep > 50,
                speedMetersPerSecond: speed,
              }),
            );

            // Sync nav state to CarPlay / Android Auto
            const nextStep = route.steps[stepIndex];
            const carPlay = CarPlayService.getInstance();
            const androidAuto = AndroidAutoService.getInstance();
            const nav = {
              currentStepIndex: stepIndex,
              distanceToNextManeuver: distToStep,
              remainingDistance: remaining,
              remainingDuration,
              isOffRoute: distToStep > 50,
              speedMetersPerSecond: speed,
            };
            if (carPlay.connected) {
              carPlay.updateManeuver(nav, nextStep?.instruction ?? '', 'imperial');
            }
            if (androidAuto.connected) {
              androidAuto.sendStep(
                nav,
                nextStep?.instruction ?? '',
                nextStep?.maneuverType ?? '',
                'imperial',
              );
            }
          }

          // Rotate map to heading when following
          dispatch(setIsFollowingUser(true));
        },
      });
    });

    return () => locationService.stopTracking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  // Background camera sync
  useEffect(() => {
    if (syncChecked.current) return;
    syncChecked.current = true;
    DeflockSync.getInstance()
      .needsSync(syncIntervalMinutes)
      .then((needs) => {
        if (needs) dispatch(syncCameras());
      });
  }, [dispatch, syncIntervalMinutes]);

  const handleSearchResult = useCallback(
    async (result: SearchResult) => {
      const locationService = LocationService.getInstance();
      const origin = locationService.getLastPosition();
      if (!origin) {
        Alert.alert('Location unavailable', 'Waiting for GPS fix…');
        return;
      }
      dispatch(setDestination(result.location));
      dispatch(calculateRoute({ origin, destination: result.location, travelMode }));
    },
    [dispatch, travelMode],
  );

  const handleRecenter = useCallback(() => {
    dispatch(setIsFollowingUser(true));
  }, [dispatch]);

  return (
    <View style={styles.container}>
      <ClearpathMap />
      <SearchBar onResultSelect={handleSearchResult} />
      <TurnByTurn />

      {/* Re-center FAB */}
      <TouchableOpacity
        style={styles.recenterBtn}
        onPress={handleRecenter}
        accessibilityLabel="Re-center map on my location"
      >
        <Text style={styles.recenterIcon}>◎</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  recenterBtn: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  recenterIcon: { fontSize: 22, color: '#3D7BFF' },
});
