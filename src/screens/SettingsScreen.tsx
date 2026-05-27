import React, { useCallback } from 'react';
import {
  View,
  Text,
  Switch,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useAppDispatch, useAppSelector } from '../store';
import {
  updatePrivacy,
  updateAvoidance,
  updateNotifications,
  setTravelMode,
  setUnits,
  resetSettings,
} from '../store/slices/settingsSlice';
import { syncCameras } from '../store/slices/cameraSlice';
import TileManager from '../services/TileManager';
import type { TravelMode, Units } from '../types';

export default function SettingsScreen() {
  const dispatch = useAppDispatch();
  const settings = useAppSelector(s => s.settings);
  const syncState = useAppSelector(s => s.cameras.sync);

  const handleClearTileCache = useCallback(async () => {
    Alert.alert('Clear Tile Cache', 'Delete all downloaded map tiles?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await TileManager.getInstance().clearCache();
          Alert.alert('Done', 'Tile cache cleared.');
        },
      },
    ]);
  }, []);

  const handleResetSettings = useCallback(() => {
    Alert.alert('Reset Settings', 'Restore all settings to defaults?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => dispatch(resetSettings()) },
    ]);
  }, [dispatch]);

  const handleSyncNow = useCallback(() => {
    dispatch(syncCameras());
  }, [dispatch]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>

        {/* ── Travel Mode ─────────────────────────────────── */}
        <Section title="Navigation">
          <SegmentRow
            label="Travel mode"
            options={['auto', 'bicycle', 'pedestrian'] as TravelMode[]}
            labels={['Car', 'Bike', 'Walk']}
            value={settings.travelMode}
            onChange={v => dispatch(setTravelMode(v as TravelMode))}
          />
          <SegmentRow
            label="Units"
            options={['imperial', 'metric'] as Units[]}
            labels={['Imperial', 'Metric']}
            value={settings.units}
            onChange={v => dispatch(setUnits(v as Units))}
          />
        </Section>

        {/* ── Avoidance ────────────────────────────────────── */}
        <Section title="Avoid Cameras">
          <SwitchRow
            label="Flock Safety"
            sublabel="Residential ALPR cameras"
            value={settings.avoidance.avoidFlockSafety}
            onChange={v => dispatch(updateAvoidance({ avoidFlockSafety: v }))}
          />
          <SwitchRow
            label="Vigilant / Motorola"
            sublabel="Commercial ALPR cameras"
            value={settings.avoidance.avoidVigilant}
            onChange={v => dispatch(updateAvoidance({ avoidVigilant: v, avoidMotorola: v }))}
          />
          <SwitchRow
            label="Unknown vendor"
            value={settings.avoidance.avoidUnknown}
            onChange={v => dispatch(updateAvoidance({ avoidUnknown: v }))}
          />
        </Section>

        {/* ── Privacy ──────────────────────────────────────── */}
        <Section title="Privacy">
          <SwitchRow
            label="Local routing only"
            sublabel="Use self-hosted Valhalla — never send location to public servers"
            value={settings.privacy.localRoutingOnly}
            onChange={v => dispatch(updatePrivacy({ localRoutingOnly: v }))}
          />
          <SwitchRow
            label="Offline tiles only"
            sublabel="Never fetch map tiles over the network"
            value={settings.privacy.offlineTilesOnly}
            onChange={v => dispatch(updatePrivacy({ offlineTilesOnly: v }))}
          />
          <InfoRow label="Analytics" value="None — zero telemetry" />
          <InfoRow label="Accounts" value="None required" />
        </Section>

        {/* ── Notifications ────────────────────────────────── */}
        <Section title="Notifications">
          <SwitchRow
            label="Camera warnings"
            sublabel="Announce upcoming ALPR cameras"
            value={settings.notifications.announceCameras}
            onChange={v => dispatch(updateNotifications({ announceCameras: v }))}
          />
        </Section>

        {/* ── Camera Data ──────────────────────────────────── */}
        <Section title="Camera Data">
          <InfoRow
            label="Last sync"
            value={syncState.lastSync ? new Date(syncState.lastSync).toLocaleString() : 'Never'}
          />
          <InfoRow label="Cameras loaded" value={String(syncState.cameraCount)} />
          <TouchableOpacity style={styles.actionBtn} onPress={handleSyncNow}>
            <Text style={styles.actionBtnText}>
              {syncState.status === 'syncing' ? 'Syncing…' : 'Sync Camera Data Now'}
            </Text>
          </TouchableOpacity>
        </Section>

        {/* ── Storage ──────────────────────────────────────── */}
        <Section title="Storage">
          <TouchableOpacity style={styles.actionBtn} onPress={handleClearTileCache}>
            <Text style={styles.actionBtnText}>Clear Tile Cache</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.destructiveBtn]} onPress={handleResetSettings}>
            <Text style={[styles.actionBtnText, styles.destructiveText]}>Reset All Settings</Text>
          </TouchableOpacity>
        </Section>

        <Text style={styles.footer}>ClearPath · MIT License · Zero telemetry</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function SwitchRow({
  label,
  sublabel,
  value,
  onChange,
}: {
  label: string;
  sublabel?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLabel}>
        <Text style={styles.rowText}>{label}</Text>
        {sublabel && <Text style={styles.sublabel}>{sublabel}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#38383A', true: '#30D158' }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowText}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function SegmentRow<T extends string>({
  label,
  options,
  labels,
  value,
  onChange,
}: {
  label: string;
  options: T[];
  labels: string[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowText}>{label}</Text>
      <View style={styles.segment}>
        {options.map((opt, i) => (
          <TouchableOpacity
            key={opt}
            style={[styles.segmentBtn, value === opt && styles.segmentBtnActive]}
            onPress={() => onChange(opt)}
          >
            <Text style={[styles.segmentText, value === opt && styles.segmentTextActive]}>
              {labels[i]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  content: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', marginBottom: 24 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#38383A',
    minHeight: 52,
  },
  rowLabel: { flex: 1 },
  rowText: { fontSize: 16, color: '#FFFFFF', flex: 1 },
  sublabel: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  infoValue: { fontSize: 15, color: '#8E8E93' },
  segment: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden', backgroundColor: '#38383A' },
  segmentBtn: { paddingVertical: 6, paddingHorizontal: 12 },
  segmentBtnActive: { backgroundColor: '#3D7BFF' },
  segmentText: { fontSize: 14, color: '#8E8E93' },
  segmentTextActive: { color: '#FFFFFF', fontWeight: '600' },
  actionBtn: {
    margin: 12,
    paddingVertical: 12,
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    alignItems: 'center',
  },
  destructiveBtn: { backgroundColor: '#3A1A1A' },
  actionBtnText: { fontSize: 16, color: '#3D7BFF', fontWeight: '500' },
  destructiveText: { color: '#FF3B30' },
  footer: {
    textAlign: 'center',
    color: '#48484A',
    fontSize: 12,
    marginTop: 16,
  },
});
