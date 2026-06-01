import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import type { SearchResult } from '../../types';
import LocationService from '../../services/LocationService';

interface SearchBarProps {
  onResultSelect: (result: SearchResult) => void;
  placeholder?: string;
}

/**
 * Local-first geocoder using the Nominatim API.
 * Only the query string is sent — no user ID, session, or location.
 */
export default function SearchBar({
  onResultSelect,
  placeholder = 'Search destination…',
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  const search = useCallback(async (text: string) => {
    if (text.length < 3) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const base = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        text,
      )}&format=json&limit=8`;
      const headers = { 'Accept-Language': 'en', Referer: 'no-referrer' };

      const pos = LocationService.getInstance().getLastPosition();

      type NominatimItem = {
        place_id: number;
        display_name: string;
        lat: string;
        lon: string;
        type: string;
      };

      const toResults = (data: NominatimItem[]) =>
        data.map((item) => ({
          id: String(item.place_id),
          osmId: item.place_id,
          label: item.display_name.split(',')[0],
          sublabel: item.display_name.split(',').slice(1, 3).join(',').trim(),
          location: { latitude: parseFloat(item.lat), longitude: parseFloat(item.lon) },
          type: 'address' as const,
        }));

      // Pass 1: strict local bounds — only show results near the user
      if (pos) {
        const BIAS = 1.5;
        const { latitude: lat, longitude: lon } = pos;
        const viewbox = `${lon - BIAS},${lat + BIAS},${lon + BIAS},${lat - BIAS}`;
        const localResp = await fetch(`${base}&viewbox=${viewbox}&bounded=1`, { headers });
        const localData: NominatimItem[] = await localResp.json();
        if (localData.length > 0) {
          setResults(toResults(localData));
          return;
        }
      }

      // Pass 2: global fallback (no bounds)
      const globalResp = await fetch(base, { headers });
      const globalData: NominatimItem[] = await globalResp.json();
      setResults(toResults(globalData));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChangeText = (text: string) => {
    setQuery(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => search(text), 400);
  };

  const handleSelect = (result: SearchResult) => {
    setQuery(result.label);
    setResults([]);
    Keyboard.dismiss();
    onResultSelect(result);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  };

  return (
    <View style={styles.container}>
      <View style={[styles.inputRow, focused && styles.inputRowFocused]}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={query}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor="#8E8E93"
          returnKeyType="search"
          clearButtonMode="never"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel="Search destination"
        />
        {loading && <ActivityIndicator size="small" color="#3D7BFF" style={styles.spinner} />}
        {query.length > 0 && !loading && (
          <TouchableOpacity onPress={handleClear} accessibilityLabel="Clear search">
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {results.length > 0 && (
        <FlatList
          style={styles.results}
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.resultRow}
              onPress={() => handleSelect(item)}
              accessibilityLabel={item.label}
            >
              <Text style={styles.resultLabel} numberOfLines={1}>
                {item.label}
              </Text>
              {item.sublabel && (
                <Text style={styles.resultSublabel} numberOfLines={1}>
                  {item.sublabel}
                </Text>
              )}
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    zIndex: 100,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  inputRowFocused: {
    borderWidth: 1.5,
    borderColor: '#3D7BFF',
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
  },
  spinner: {
    marginLeft: 8,
  },
  clearBtn: {
    fontSize: 16,
    color: '#8E8E93',
    paddingHorizontal: 4,
  },
  results: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    marginTop: 4,
    maxHeight: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  resultRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  resultLabel: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  resultSublabel: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: '#38383A',
    marginLeft: 16,
  },
});
