import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../store';
import { calculateRoute, setDestination } from '../store/slices/routeSlice';
import SearchBar from '../components/search/SearchBar';
import LocationService from '../services/LocationService';
import type { SearchResult } from '../types';

const QUICK_DESTINATIONS = [
  { label: 'Home', icon: '🏠' },
  { label: 'Work', icon: '💼' },
];

export default function SearchScreen() {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { travelMode } = useAppSelector(s => s.settings);
  const [recentSearches] = useState<SearchResult[]>([]);

  const handleSelect = useCallback(
    async (result: SearchResult) => {
      const origin = LocationService.getInstance().getLastPosition();
      if (!origin) return;

      dispatch(setDestination(result.location));
      dispatch(calculateRoute({ origin, destination: result.location, travelMode }));

      navigation.goBack();
    },
    [dispatch, navigation, travelMode],
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Search</Text>
      </View>

      <View style={styles.searchWrapper}>
        <SearchBar onResultSelect={handleSelect} placeholder="Where to?" />
      </View>

      {recentSearches.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent</Text>
          <FlatList
            data={recentSearches}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.recentItem} onPress={() => handleSelect(item)}>
                <Text style={styles.recentIcon}>🕐</Text>
                <View style={styles.recentText}>
                  <Text style={styles.recentLabel}>{item.label}</Text>
                  {item.sublabel && (
                    <Text style={styles.recentSublabel}>{item.sublabel}</Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy</Text>
        <View style={styles.privacyBadge}>
          <Text style={styles.privacyIcon}>🔒</Text>
          <Text style={styles.privacyText}>
            Search queries go only to Nominatim (OpenStreetMap). No account, no tracking.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backBtn: { marginRight: 12 },
  backText: { fontSize: 16, color: '#3D7BFF' },
  title: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  searchWrapper: { paddingHorizontal: 16, paddingVertical: 8 },
  section: { paddingHorizontal: 16, marginTop: 24 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#38383A',
  },
  recentIcon: { fontSize: 18, marginRight: 12 },
  recentText: { flex: 1 },
  recentLabel: { fontSize: 15, color: '#FFFFFF', fontWeight: '500' },
  recentSublabel: { fontSize: 13, color: '#8E8E93', marginTop: 2 },
  privacyBadge: {
    flexDirection: 'row',
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 12,
    alignItems: 'flex-start',
  },
  privacyIcon: { fontSize: 18, marginRight: 8 },
  privacyText: { flex: 1, fontSize: 14, color: '#8E8E93', lineHeight: 20 },
});
