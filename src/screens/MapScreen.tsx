import React, { useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert } from 'react-native';
import { useAppDispatch, useAppSelector } from '../store';
import { setCenter, setIsFollowingUser } from '../store/slices/mapSlice';
import {
  setCurrentRoute,
  setPendingDestination,
  updateNavigation,
  setArrived,
  clearRoute,
} from '../store/slices/routeSlice';
import { syncCameras } from '../store/slices/cameraSlice';
import ClearpathMap from '../components/map/ClearpathMap';
import TurnByTurn from '../components/navigation/TurnByTurn';
import SearchBar from '../components/search/SearchBar';
import PlaceDetailCard from '../components/map/PlaceDetailCard';
import LocationService from '../services/LocationService';
import CarPlayService from '../services/CarPlayService';
import AndroidAutoService from '../services/AndroidAutoService';
import DeflockSync from '../services/DeflockSync';
import TTSService from '../services/TTSService';
import { haversineDistance } from '../utils/geo';
import type { SearchResult, LatLng, Route } from '../types';

const ARRIVAL_THRESHOLD_METERS = 25;

export default function MapScreen() {
  const dispatch = useAppDispatch();
  const { syncIntervalMinutes, units, notifications } = useAppSelector(
    (s) => s.settings,
  );
  const {
    current: route,
    navigation: navState,
    status,
    pendingDestination,
  } = useAppSelector((s) => s.route);
  const syncChecked = useRef(false);
  const arrivedRef = useRef(false);

  useEffect(() => {
    const locationService = LocationService.getInstance();
    const tts = TTSService.getInstance();

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

          if (route && navState) {
            const lastStepIndex = route.steps.length - 1;
            const currentStep = route.steps[navState.currentStepIndex];
            if (!currentStep) return;

            const distToStep = haversineDistance(location, currentStep.location);

            // Arrival detection
            if (
              !arrivedRef.current &&
              navState.currentStepIndex >= lastStepIndex - 1 &&
              distToStep < ARRIVAL_THRESHOLD_METERS
            ) {
              arrivedRef.current = true;
              tts.announceArrival();
              dispatch(setArrived());
              return;
            }

            let stepIndex = navState.currentStepIndex;
            if (distToStep < 15 && stepIndex < lastStepIndex) {
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

            // TTS turn announcements
            const currentInstruction = route.steps[stepIndex]?.instruction ?? '';
            tts.checkManeuver(stepIndex, distToStep, currentInstruction, units);

            // TTS camera warnings
            if (notifications.announceCameras) {
              // Closest camera to current position handled via rough proximity check
              tts.announceCamera(distToStep, notifications.cameraWarningDistanceMeters);
            }

            // Sync to CarPlay / Android Auto
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

          dispatch(setIsFollowingUser(true));
        },
      });
    });

    return () => locationService.stopTracking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  // Reset arrival flag when a new route starts
  useEffect(() => {
    if (status === 'active') {
      arrivedRef.current = false;
      TTSService.getInstance().reset();
    }
  }, [status]);

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

  // When a search result is selected on this screen, show the detail card
  const handleSearchResult = useCallback(
    (result: SearchResult) => {
      dispatch(setPendingDestination(result));
    },
    [dispatch],
  );

  const handleStartNavigation = useCallback(
    (selectedRoute: Route) => {
      dispatch(setPendingDestination(null));
      dispatch(setCurrentRoute(selectedRoute));
    },
    [dispatch],
  );

  const handleDismissCard = useCallback(() => {
    dispatch(setPendingDestination(null));
  }, [dispatch]);

  const handleRecenter = useCallback(() => {
    dispatch(setIsFollowingUser(true));
  }, [dispatch]);

  // Show arrived screen briefly then auto-clear
  useEffect(() => {
    if (status === 'arrived') {
      const timer = setTimeout(() => dispatch(clearRoute()), 4000);
      return () => clearTimeout(timer);
    }
  }, [status, dispatch]);

  return (
    <View style={styles.container}>
      <ClearpathMap />

      {/* Only show SearchBar when no detail card is open and not actively navigating */}
      {!pendingDestination && status !== 'active' && status !== 'calculating' && (
        <SearchBar onResultSelect={handleSearchResult} />
      )}

      <TurnByTurn />

      {/* Arrived banner */}
      {status === 'arrived' && (
        <View style={styles.arrivedBanner}>
          <Text style={styles.arrivedText}>📍 You have arrived!</Text>
        </View>
      )}

      {/* Re-center FAB */}
      {!pendingDestination && (
        <TouchableOpacity
          style={styles.recenterBtn}
          onPress={handleRecenter}
          accessibilityLabel="Re-center map on my location"
        >
          <Text style={styles.recenterIcon}>◎</Text>
        </TouchableOpacity>
      )}

      {/* Place detail card — overlays the map */}
      {pendingDestination && (
        <PlaceDetailCard
          result={pendingDestination}
          origin={LocationService.getInstance().getLastPosition() ?? { latitude: 0, longitude: 0 }}
          onStartNavigation={handleStartNavigation}
          onDismiss={handleDismissCard}
        />
      )}
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
  arrivedBanner: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 16,
  },
  arrivedText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
