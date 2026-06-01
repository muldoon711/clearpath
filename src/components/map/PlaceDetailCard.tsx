import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import type { SearchResult } from '../../types';

interface OsmDetails {
  phone?: string;
  website?: string;
  opening_hours?: string;
}

interface Props {
  result: SearchResult;
  onStartNavigation: () => void;
  onDismiss: () => void;
}

export default function PlaceDetailCard({ result, onStartNavigation, onDismiss }: Props) {
  const [details, setDetails] = useState<OsmDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (!result.osmId) return;
    setLoadingDetails(true);
    fetch(
      `https://nominatim.openstreetmap.org/details?place_id=${result.osmId}&format=json&extratags=1`,
      { headers: { 'Accept-Language': 'en', Referer: 'no-referrer' } },
    )
      .then((r) => r.json())
      .then((data) => {
        const tags = data?.extratags ?? {};
        setDetails({
          phone: tags.phone ?? tags['contact:phone'],
          website: tags.website ?? tags['contact:website'] ?? tags.url,
          opening_hours: tags.opening_hours,
        });
      })
      .catch(() => setDetails({}))
      .finally(() => setLoadingDetails(false));
  }, [result.osmId]);

  const hasDetails = details && (details.phone || details.website || details.opening_hours);

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

        {loadingDetails ? (
          <ActivityIndicator color="#3D7BFF" style={styles.loader} />
        ) : hasDetails ? (
          <View style={styles.detailsContainer}>
            {details.phone ? (
              <TouchableOpacity
                style={styles.infoRow}
                onPress={() => Linking.openURL(`tel:${details.phone}`)}
              >
                <Text style={styles.infoIcon}>📞</Text>
                <Text style={styles.infoText}>{details.phone}</Text>
              </TouchableOpacity>
            ) : null}
            {details.website ? (
              <TouchableOpacity
                style={styles.infoRow}
                onPress={() => Linking.openURL(details.website!)}
              >
                <Text style={styles.infoIcon}>🌐</Text>
                <Text style={styles.infoText} numberOfLines={1}>
                  {details.website}
                </Text>
              </TouchableOpacity>
            ) : null}
            {details.opening_hours ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoIcon}>🕐</Text>
                <Text style={styles.infoText}>{details.opening_hours}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <TouchableOpacity style={styles.navigateBtn} onPress={onStartNavigation}>
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
  loader: {
    marginVertical: 16,
  },
  detailsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#38383A',
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
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
  navigateBtn: {
    marginTop: 16,
    backgroundColor: '#3D7BFF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  navigateBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
