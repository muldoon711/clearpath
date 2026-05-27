import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { LatLng, MapState, MapStyle } from '../../types';

const initialState: MapState = {
  center: { latitude: 37.7749, longitude: -122.4194 },
  zoom: 13,
  bearing: 0,
  pitch: 0,
  isFollowingUser: true,
  mapStyle: 'streets',
  showCameras: true,
};

const mapSlice = createSlice({
  name: 'map',
  initialState,
  reducers: {
    setCenter(state, action: PayloadAction<LatLng>) {
      state.center = action.payload;
    },
    setZoom(state, action: PayloadAction<number>) {
      state.zoom = action.payload;
    },
    setBearing(state, action: PayloadAction<number>) {
      state.bearing = action.payload;
    },
    setPitch(state, action: PayloadAction<number>) {
      state.pitch = action.payload;
    },
    setIsFollowingUser(state, action: PayloadAction<boolean>) {
      state.isFollowingUser = action.payload;
    },
    setMapStyle(state, action: PayloadAction<MapStyle>) {
      state.mapStyle = action.payload;
    },
    setShowCameras(state, action: PayloadAction<boolean>) {
      state.showCameras = action.payload;
    },
    updateViewport(
      state,
      action: PayloadAction<Partial<Pick<MapState, 'center' | 'zoom' | 'bearing' | 'pitch'>>>,
    ) {
      Object.assign(state, action.payload);
    },
  },
});

export const {
  setCenter,
  setZoom,
  setBearing,
  setPitch,
  setIsFollowingUser,
  setMapStyle,
  setShowCameras,
  updateViewport,
} = mapSlice.actions;

export default mapSlice.reducer;
