import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type {
  AppSettings,
  PrivacySettings,
  AvoidanceSettings,
  NotificationSettings,
  TravelMode,
  MapStyle,
  Units,
  Language,
} from '../../types';

const DEFAULT_VALHALLA = 'https://valhalla1.openstreetmap.de/route';
const DEFAULT_DEFLOCK = 'https://deflock.me/api/v1/cameras.geojson';

const initialState: AppSettings = {
  travelMode: 'auto',
  units: 'imperial',
  language: 'en',
  mapStyle: 'streets',
  privacy: {
    localRoutingOnly: false,
    noTelemetry: true,
    offlineTilesOnly: false,
  },
  avoidance: {
    avoidFlockSafety: true,
    avoidVigilant: true,
    avoidMotorola: true,
    avoidUnknown: false,
    avoidRadiusMeters: 50,
  },
  notifications: {
    announceCameras: true,
    cameraWarningDistanceMeters: 300,
  },
  valhallaEndpoint: DEFAULT_VALHALLA,
  deflockEndpoint: DEFAULT_DEFLOCK,
  syncIntervalMinutes: 60,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setTravelMode(state, action: PayloadAction<TravelMode>) {
      state.travelMode = action.payload;
    },
    setUnits(state, action: PayloadAction<Units>) {
      state.units = action.payload;
    },
    setLanguage(state, action: PayloadAction<Language>) {
      state.language = action.payload;
    },
    setMapStyle(state, action: PayloadAction<MapStyle>) {
      state.mapStyle = action.payload;
    },
    updatePrivacy(state, action: PayloadAction<Partial<PrivacySettings>>) {
      Object.assign(state.privacy, action.payload);
    },
    updateAvoidance(state, action: PayloadAction<Partial<AvoidanceSettings>>) {
      Object.assign(state.avoidance, action.payload);
    },
    updateNotifications(state, action: PayloadAction<Partial<NotificationSettings>>) {
      Object.assign(state.notifications, action.payload);
    },
    setValhallaEndpoint(state, action: PayloadAction<string>) {
      state.valhallaEndpoint = action.payload;
    },
    setDeflockEndpoint(state, action: PayloadAction<string>) {
      state.deflockEndpoint = action.payload;
    },
    setSyncInterval(state, action: PayloadAction<number>) {
      state.syncIntervalMinutes = action.payload;
    },
    resetSettings() {
      return initialState;
    },
  },
});

export const {
  setTravelMode,
  setUnits,
  setLanguage,
  setMapStyle,
  updatePrivacy,
  updateAvoidance,
  updateNotifications,
  setValhallaEndpoint,
  setDeflockEndpoint,
  setSyncInterval,
  resetSettings,
} = settingsSlice.actions;

export default settingsSlice.reducer;
