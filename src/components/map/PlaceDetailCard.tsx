import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useAppSelector } from '../../store';
import ValhallaRouter from '../../services/ValhallaRouter';
import CameraDatabase from '../../services/CameraDatabase';
import { formatDistance, formatDuration } from '../../utils/geo';
import type { Route, SearchResult, LatLng } from '../../types';

interface OsmDetails {
  phone?: string;
  website?: string;
  opening_hours?: string;
}

interface RouteOption {
  route: Route;
  label: string;
  badge?: string;
  badgeColor?: string;
}

interface Props {
  result: SearchResult;
  origin: LatLng;
  onStartNavigation: (route: Route) => void;
  onDismiss: () => void;
}

export default function PlaceDetailCard({ result, origin, onStartNavigation, onDismiss }: Props) {
  const { avoidance, travelMode, valhallaEndpoint, routeOptions, units } = useAppSelector(
    (s) => s.settings,
  );

  const [osmDetails, setOsmDetails] = useState<OsmDetails | null>(null);
  const [routeOpts, setRouteOpts] = useState<RouteOption[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [calculating, setCalculating] = useState(true);
  const [routeError, setRouteError] = useState(false);

  // Fetch OSM place details (phone/website/hours)
  useEffect(() => {
    if (!result.osmId) return;
    fetch(
      `https://nominatim.openstreetmap.org/details?place_id=${result.osmId}&format=json&extratags=1`,
      { headers: { 'Accept-Language': 'en', Referer: 'no-referrer' } },
    )
      .then((r) => r.json())
      .then((data) => {
        const tags = data?.extratags ?? {};
        setOsmDetails({
          phone: tags.phone ?? tags['contact:phone'],
          website: tags.website ?? tags['contact:website'] ?? tags.url,
          opening_hours: tags.opening_hours,
        });
      })
      .catch(() => setOsmDetails({}));
  }, [result.osmId]);

  // Pre-calculate route options when the card opens
  useEffect(() => {
    const destination = result.location;
    const router = ValhallaRouter.getInstance();
    const baseOpts = {
      origin,
      destination,
      travelMode,
      endpoint: valhallaEndpoint,
      avoidRadiusMeters: avoidance.avoidRadiusMeters,
      avoidTolls: routeOptions?.avoidTolls,
      avoidHighways: routeOptions?.avoidHighways,
      avoidFerries: routeOptions?.avoidFerries,
    };

    const run = async () => {
      setCalculating(true);
      setRouteError(false);

      // Load cameras in the bounding box around the trip
      const cameras = await CameraDatabase.getInstance().getCamerasInBounds({
        minLat: Math.min(origin.latitude, destination.latitude) - 0.1,
        minLng: Math.min(origin.longitude, destination.longitude) - 0.1,
        maxLat: Math.max(origin.latitude, destination.latitude) + 0.1,
        maxLng: Math.max(origin.longitude, destination.longitude) + 0.1,
      });

      const vendorsToAvoid = new Set<string>();
      if (avoidance.avoidFlockSafety) vendorsToAvoid.add('flock_safety');
      if (avoidance.avoidVigilant) vendorsToAvoid.add('vigilant');
      if (avoidance.avoidMotorola) vendorsToAvoid.add('motorola');
      if (avoidance.avoidUnknown) vendorsToAvoid.add('unknown');
      const avoidCameras = cameras.filter(
        (c) => vendorsToAvoid.has(c.vendor) && c.status === 'active',
      );

      // Calculate both routes in parallel
      const [cameraFree, standard] = await Promise.all([
        avoidCameras.length > 0
          ? router.route({ ...baseOpts, avoidCameras })
          : Promise.resolve(null),
        router.route({ ...baseOpts, avoidCameras: [] }),
      ]);

      const options: RouteOption[] = [];

      if (cameraFree) {
        options.push({
          route: cameraFree,
          label: '🛡️  Camera-free',
          badge: `${avoidCameras.length} avoided`,
          badgeColor: '#30D158',
        });
      }

      if (standard) {
        const isDifferent =
          !cameraFree ||
          Math.abs(standard.totalDuration - cameraFree.totalDuration) > 60 ||
          Math.abs(standard.totalDistance - cameraFree.totalDistance) > 500;

        if (isDifferent || !cameraFree) {
          options.push({
            route: standard,
            label: cameraFree ? '⚡  Fastest' : '⚡  Route',
            badge:
              avoidCameras.length > 0 && !cameraFree
                ? `${avoidCameras.length} camera${avoidCameras.length !== 1 ? 's' : ''} on route`
                : undefined,
            badgeColor: '#FF9500',
          });
        }
      }

      if (options.length === 0) {
        // Both failed — shouldn't happen but handle gracefully
        setRouteError(true);
      } else {
        setRouteOpts(options);
        setSelectedIndex(0);
      }

      setCalculating(false);
    };

    run();
  }, [
    origin,
    result.location,
    travelMode,
    valhallaEndpoint,
    avoidance,
    routeOptions,
  ]);

  const selectedRoute = routeOpts[selectedIndex]?.route;
  const hasDetails =
    osmDetails && (osmDetails.phone || osmDetails.website || osmDetails.opening_hours);

  return (
    <>
      <TouchableOpacity style={styles.overlay} onPress={onDismiss} activeOpacity={1} />

      <View style={styles.card}>
        <View style={styles.handle} />

        <Text style={styles.name} numberOfLines={2}>
          {result.label}
        </Text>
        {result.sublabel ? (
          <Text style={styles.address} numberOfLines={2}>
            {result.sublabel}
          </Text>
        ) : null}

        {/* OSM place details */}
        {hasDetails ? (
          <View style={styles.detailsContainer}>
            {osmDetails.phone ? (
              <TouchableOpacity
                style={styles.infoRow}
                onPress={() => Linking.openURL(`tel:${osmDetails.phone}`)}
              >
                <Text style={styles.infoIcon}>📞</Text>
                <Text style={styles.infoText}>{osmDetails.phone}</Text>
              </TouchableOpacity>
            ) : null}
            {osmDetails.website ? (
              <TouchableOpacity
                style={styles.infoRow}
                onPress={() => Linking.openURL(osmDetails.website!)}
              >
                <Text style={styles.infoIcon}>🌐</Text>
                <Text style={styles.infoText} numberOfLines={1}>
                  {osmDetails.website}
                </Text>
              </TouchableOpacity>
            ) : null}
            {osmDetails.opening_hours ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoIcon}>🕐</Text>
                <Text style={styles.infoText}>{osmDetails.opening_hours}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Route options */}
        <View style={styles.routeSection}>
          <Text style={styles.routeSectionTitle}>Routes</Text>
          {calculating ? (
            <View style={styles.routeLoading}>
              <ActivityIndicator color="#3D7BFF" />
              <Text style={styles.routeLoadingText}>Calculating routes…</Text>
            </View>
          ) : routeError ? (
            <View style={styles.routeErrorRow}>
              <Text style={styles.routeErrorText}>
                Couldn't calculate a route. Check your connection.
              </Text>
            </View>
          ) : (
            routeOpts.map((opt, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.routeOption, i === selectedIndex && styles.routeOptionSelected]}
                onPress={() => setSelectedIndex(i)}
                activeOpacity={0.7}
              >
                <View style={styles.routeOptionLeft}>
                  <Text style={styles.routeOptionLabel}>{opt.label}</Text>
                  <Text style={styles.routeOptionMeta}>
                    {formatDuration(opt.route.totalDuration)} ·{' '}
                    {formatDistance(opt.route.totalDistance, units)}
                  </Text>
                </View>
                {opt.badge ? (
                  <View style={[styles.badge, { backgroundColor: opt.badgeColor + '22' }]}>
                    <Text style={[styles.badgeText, { color: opt.badgeColor }]}>{opt.badge}</Text>
                  </View>
                ) : null}
                {i === selectedIndex ? (
                  <View style={styles.selectedDot} />
                ) : (
                  <View style={styles.unselectedDot} />
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        <TouchableOpacity
          style={[styles.navigateBtn, (!selectedRoute || calculating) && styles.navigateBtnDisabled]}
          onPress={() => selectedRoute && onStartNavigation(selectedRoute)}
          disabled={!selectedRoute || calculating}
        >
          <Text style={styles.navigateBtnText}>Start Navigation</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  card: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 20,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#48484A',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  address: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
  },
  detailsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#38383A',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#38383A',
  },
  infoIcon: {
    fontSize: 16,
    marginRight: 12,
    width: 24,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 15,
    color: '#FFFFFF',
    flex: 1,
  },
  routeSection: {
    marginTop: 8,
    marginBottom: 4,
  },
  routeSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  routeLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  routeLoadingText: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 10,
  },
  routeErrorRow: {
    paddingVertical: 12,
  },
  routeErrorText: {
    fontSize: 14,
    color: '#FF3B30',
  },
  routeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  routeOptionSelected: {
    borderColor: '#3D7BFF',
    backgroundColor: '#1A2B4A',
  },
  routeOptionLeft: {
    flex: 1,
  },
  routeOptionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  routeOptionMeta: {
    fontSize: 13,
    color: '#8E8E93',
  },
  badge: {
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginRight: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  selectedDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#3D7BFF',
    borderWidth: 2,
    borderColor: '#3D7BFF',
  },
  unselectedDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#48484A',
  },
  navigateBtn: {
    marginTop: 12,
    backgroundColor: '#3D7BFF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  navigateBtnDisabled: {
    backgroundColor: '#2C3E5A',
  },
  navigateBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
