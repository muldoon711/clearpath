import mapReducer, {
  setCenter,
  setZoom,
  setBearing,
  setPitch,
  setIsFollowingUser,
  setMapStyle,
  setShowCameras,
  updateViewport,
} from '../../store/slices/mapSlice';
import type { MapState } from '../../types';

const initialState: MapState = {
  center: { latitude: 37.7749, longitude: -122.4194 },
  zoom: 13,
  bearing: 0,
  pitch: 0,
  isFollowingUser: true,
  mapStyle: 'streets',
  showCameras: true,
};

describe('mapSlice', () => {
  describe('initial state', () => {
    it('has the correct default center (SF)', () => {
      const state = mapReducer(undefined, { type: '@@INIT' });
      expect(state.center).toEqual({ latitude: 37.7749, longitude: -122.4194 });
    });

    it('has the correct default zoom (13)', () => {
      const state = mapReducer(undefined, { type: '@@INIT' });
      expect(state.zoom).toBe(13);
    });

    it('has bearing 0, pitch 0', () => {
      const state = mapReducer(undefined, { type: '@@INIT' });
      expect(state.bearing).toBe(0);
      expect(state.pitch).toBe(0);
    });

    it('is following user by default', () => {
      const state = mapReducer(undefined, { type: '@@INIT' });
      expect(state.isFollowingUser).toBe(true);
    });

    it('uses "streets" map style by default', () => {
      const state = mapReducer(undefined, { type: '@@INIT' });
      expect(state.mapStyle).toBe('streets');
    });

    it('shows cameras by default', () => {
      const state = mapReducer(undefined, { type: '@@INIT' });
      expect(state.showCameras).toBe(true);
    });
  });

  describe('setCenter', () => {
    it('updates the center coordinate', () => {
      const newCenter = { latitude: 34.0522, longitude: -118.2437 };
      const state = mapReducer(initialState, setCenter(newCenter));
      expect(state.center).toEqual(newCenter);
    });

    it('does not mutate other fields', () => {
      const newCenter = { latitude: 34.0522, longitude: -118.2437 };
      const state = mapReducer(initialState, setCenter(newCenter));
      expect(state.zoom).toBe(initialState.zoom);
      expect(state.bearing).toBe(initialState.bearing);
    });
  });

  describe('setZoom', () => {
    it('updates zoom level', () => {
      const state = mapReducer(initialState, setZoom(15));
      expect(state.zoom).toBe(15);
    });

    it('accepts fractional zoom', () => {
      const state = mapReducer(initialState, setZoom(14.5));
      expect(state.zoom).toBe(14.5);
    });
  });

  describe('setBearing', () => {
    it('updates bearing', () => {
      const state = mapReducer(initialState, setBearing(90));
      expect(state.bearing).toBe(90);
    });

    it('allows negative bearing', () => {
      const state = mapReducer(initialState, setBearing(-45));
      expect(state.bearing).toBe(-45);
    });
  });

  describe('setPitch', () => {
    it('updates pitch', () => {
      const state = mapReducer(initialState, setPitch(45));
      expect(state.pitch).toBe(45);
    });
  });

  describe('setIsFollowingUser', () => {
    it('sets isFollowingUser to false', () => {
      const state = mapReducer(initialState, setIsFollowingUser(false));
      expect(state.isFollowingUser).toBe(false);
    });

    it('sets isFollowingUser to true', () => {
      const offState: MapState = { ...initialState, isFollowingUser: false };
      const state = mapReducer(offState, setIsFollowingUser(true));
      expect(state.isFollowingUser).toBe(true);
    });
  });

  describe('setMapStyle', () => {
    it('updates map style to satellite', () => {
      const state = mapReducer(initialState, setMapStyle('satellite'));
      expect(state.mapStyle).toBe('satellite');
    });

    it('updates map style to dark', () => {
      const state = mapReducer(initialState, setMapStyle('dark'));
      expect(state.mapStyle).toBe('dark');
    });

    it('updates map style to topo', () => {
      const state = mapReducer(initialState, setMapStyle('topo'));
      expect(state.mapStyle).toBe('topo');
    });
  });

  describe('setShowCameras', () => {
    it('hides cameras', () => {
      const state = mapReducer(initialState, setShowCameras(false));
      expect(state.showCameras).toBe(false);
    });

    it('shows cameras again', () => {
      const hiddenState: MapState = { ...initialState, showCameras: false };
      const state = mapReducer(hiddenState, setShowCameras(true));
      expect(state.showCameras).toBe(true);
    });
  });

  describe('updateViewport', () => {
    it('updates all specified viewport fields', () => {
      const state = mapReducer(
        initialState,
        updateViewport({ center: { latitude: 40, longitude: -75 }, zoom: 16, bearing: 45, pitch: 30 }),
      );
      expect(state.center).toEqual({ latitude: 40, longitude: -75 });
      expect(state.zoom).toBe(16);
      expect(state.bearing).toBe(45);
      expect(state.pitch).toBe(30);
    });

    it('only updates specified keys, leaving others intact', () => {
      const state = mapReducer(initialState, updateViewport({ zoom: 18 }));
      expect(state.zoom).toBe(18);
      // All other fields remain at initial values
      expect(state.center).toEqual(initialState.center);
      expect(state.bearing).toBe(initialState.bearing);
      expect(state.pitch).toBe(initialState.pitch);
      expect(state.isFollowingUser).toBe(initialState.isFollowingUser);
      expect(state.mapStyle).toBe(initialState.mapStyle);
      expect(state.showCameras).toBe(initialState.showCameras);
    });

    it('partial update with only bearing does not affect zoom', () => {
      const state = mapReducer(initialState, updateViewport({ bearing: 180 }));
      expect(state.bearing).toBe(180);
      expect(state.zoom).toBe(initialState.zoom);
    });

    it('partial update with only center works', () => {
      const newCenter = { latitude: 51.5074, longitude: -0.1278 };
      const state = mapReducer(initialState, updateViewport({ center: newCenter }));
      expect(state.center).toEqual(newCenter);
      expect(state.pitch).toBe(initialState.pitch);
    });
  });
});
