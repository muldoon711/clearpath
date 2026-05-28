import settingsReducer, {
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
} from '../../store/slices/settingsSlice';
import type { AppSettings } from '../../types';

const DEFAULT_VALHALLA = 'https://valhalla1.openstreetmap.de/route';
const DEFAULT_DEFLOCK = 'https://deflock.me/api/v1/cameras.geojson';

describe('settingsSlice', () => {
  let initialState: AppSettings;

  beforeEach(() => {
    // Derive initial state fresh from the reducer
    initialState = settingsReducer(undefined, { type: '@@INIT' });
  });

  describe('initial state', () => {
    it('defaults travelMode to "auto"', () => {
      expect(initialState.travelMode).toBe('auto');
    });

    it('defaults units to "imperial"', () => {
      expect(initialState.units).toBe('imperial');
    });

    it('defaults language to "en"', () => {
      expect(initialState.language).toBe('en');
    });

    it('defaults mapStyle to "streets"', () => {
      expect(initialState.mapStyle).toBe('streets');
    });

    it('has correct privacy defaults', () => {
      expect(initialState.privacy).toEqual({
        localRoutingOnly: false,
        noTelemetry: true,
        offlineTilesOnly: false,
      });
    });

    it('has correct avoidance defaults', () => {
      expect(initialState.avoidance).toEqual({
        avoidFlockSafety: true,
        avoidVigilant: true,
        avoidMotorola: true,
        avoidUnknown: false,
        avoidRadiusMeters: 50,
      });
    });

    it('has correct notification defaults', () => {
      expect(initialState.notifications).toEqual({
        announceCameras: true,
        cameraWarningDistanceMeters: 300,
      });
    });

    it('defaults valhallaEndpoint to the OSM instance', () => {
      expect(initialState.valhallaEndpoint).toBe(DEFAULT_VALHALLA);
    });

    it('defaults deflockEndpoint to deflock.me', () => {
      expect(initialState.deflockEndpoint).toBe(DEFAULT_DEFLOCK);
    });

    it('defaults syncIntervalMinutes to 60', () => {
      expect(initialState.syncIntervalMinutes).toBe(60);
    });
  });

  describe('setTravelMode', () => {
    it('updates travelMode to "bicycle"', () => {
      const state = settingsReducer(initialState, setTravelMode('bicycle'));
      expect(state.travelMode).toBe('bicycle');
    });

    it('updates travelMode to "pedestrian"', () => {
      const state = settingsReducer(initialState, setTravelMode('pedestrian'));
      expect(state.travelMode).toBe('pedestrian');
    });
  });

  describe('setUnits', () => {
    it('updates units to "metric"', () => {
      const state = settingsReducer(initialState, setUnits('metric'));
      expect(state.units).toBe('metric');
    });

    it('updates units back to "imperial"', () => {
      const metricState = settingsReducer(initialState, setUnits('metric'));
      const state = settingsReducer(metricState, setUnits('imperial'));
      expect(state.units).toBe('imperial');
    });
  });

  describe('setLanguage', () => {
    it('updates language to "es"', () => {
      const state = settingsReducer(initialState, setLanguage('es'));
      expect(state.language).toBe('es');
    });

    it('updates language to "fr"', () => {
      const state = settingsReducer(initialState, setLanguage('fr'));
      expect(state.language).toBe('fr');
    });

    it('updates language to "de"', () => {
      const state = settingsReducer(initialState, setLanguage('de'));
      expect(state.language).toBe('de');
    });
  });

  describe('setMapStyle', () => {
    it('updates mapStyle to "dark"', () => {
      const state = settingsReducer(initialState, setMapStyle('dark'));
      expect(state.mapStyle).toBe('dark');
    });

    it('updates mapStyle to "satellite"', () => {
      const state = settingsReducer(initialState, setMapStyle('satellite'));
      expect(state.mapStyle).toBe('satellite');
    });
  });

  describe('updatePrivacy', () => {
    it('enables localRoutingOnly', () => {
      const state = settingsReducer(initialState, updatePrivacy({ localRoutingOnly: true }));
      expect(state.privacy.localRoutingOnly).toBe(true);
    });

    it('disables noTelemetry', () => {
      const state = settingsReducer(initialState, updatePrivacy({ noTelemetry: false }));
      expect(state.privacy.noTelemetry).toBe(false);
    });

    it('enables offlineTilesOnly', () => {
      const state = settingsReducer(initialState, updatePrivacy({ offlineTilesOnly: true }));
      expect(state.privacy.offlineTilesOnly).toBe(true);
    });

    it('partial update preserves untouched privacy fields', () => {
      const state = settingsReducer(initialState, updatePrivacy({ localRoutingOnly: true }));
      // noTelemetry and offlineTilesOnly should be unchanged
      expect(state.privacy.noTelemetry).toBe(initialState.privacy.noTelemetry);
      expect(state.privacy.offlineTilesOnly).toBe(initialState.privacy.offlineTilesOnly);
    });

    it('can update multiple privacy fields at once', () => {
      const state = settingsReducer(
        initialState,
        updatePrivacy({ localRoutingOnly: true, offlineTilesOnly: true }),
      );
      expect(state.privacy.localRoutingOnly).toBe(true);
      expect(state.privacy.offlineTilesOnly).toBe(true);
      expect(state.privacy.noTelemetry).toBe(initialState.privacy.noTelemetry);
    });
  });

  describe('updateAvoidance', () => {
    it('disables avoidFlockSafety', () => {
      const state = settingsReducer(initialState, updateAvoidance({ avoidFlockSafety: false }));
      expect(state.avoidance.avoidFlockSafety).toBe(false);
    });

    it('enables avoidUnknown', () => {
      const state = settingsReducer(initialState, updateAvoidance({ avoidUnknown: true }));
      expect(state.avoidance.avoidUnknown).toBe(true);
    });

    it('updates avoidRadiusMeters', () => {
      const state = settingsReducer(initialState, updateAvoidance({ avoidRadiusMeters: 100 }));
      expect(state.avoidance.avoidRadiusMeters).toBe(100);
    });

    it('partial update preserves untouched avoidance fields', () => {
      const state = settingsReducer(initialState, updateAvoidance({ avoidRadiusMeters: 75 }));
      expect(state.avoidance.avoidFlockSafety).toBe(initialState.avoidance.avoidFlockSafety);
      expect(state.avoidance.avoidVigilant).toBe(initialState.avoidance.avoidVigilant);
    });
  });

  describe('updateNotifications', () => {
    it('disables announceCameras', () => {
      const state = settingsReducer(initialState, updateNotifications({ announceCameras: false }));
      expect(state.notifications.announceCameras).toBe(false);
    });

    it('updates cameraWarningDistanceMeters', () => {
      const state = settingsReducer(
        initialState,
        updateNotifications({ cameraWarningDistanceMeters: 500 }),
      );
      expect(state.notifications.cameraWarningDistanceMeters).toBe(500);
    });

    it('partial update preserves untouched notification fields', () => {
      const state = settingsReducer(
        initialState,
        updateNotifications({ cameraWarningDistanceMeters: 200 }),
      );
      expect(state.notifications.announceCameras).toBe(initialState.notifications.announceCameras);
    });
  });

  describe('setValhallaEndpoint', () => {
    it('updates the valhalla endpoint', () => {
      const newEndpoint = 'https://my-valhalla.example.com/route';
      const state = settingsReducer(initialState, setValhallaEndpoint(newEndpoint));
      expect(state.valhallaEndpoint).toBe(newEndpoint);
    });
  });

  describe('setDeflockEndpoint', () => {
    it('updates the deflock endpoint', () => {
      const newEndpoint = 'https://my-mirror.example.com/cameras.geojson';
      const state = settingsReducer(initialState, setDeflockEndpoint(newEndpoint));
      expect(state.deflockEndpoint).toBe(newEndpoint);
    });
  });

  describe('setSyncInterval', () => {
    it('updates syncIntervalMinutes', () => {
      const state = settingsReducer(initialState, setSyncInterval(30));
      expect(state.syncIntervalMinutes).toBe(30);
    });

    it('allows setting to 0 (disable background sync)', () => {
      const state = settingsReducer(initialState, setSyncInterval(0));
      expect(state.syncIntervalMinutes).toBe(0);
    });
  });

  describe('resetSettings', () => {
    it('returns all fields to their initial values', () => {
      // Modify several fields
      let state = settingsReducer(initialState, setTravelMode('bicycle'));
      state = settingsReducer(state, setUnits('metric'));
      state = settingsReducer(
        state,
        updatePrivacy({ localRoutingOnly: true, offlineTilesOnly: true }),
      );
      state = settingsReducer(state, updateAvoidance({ avoidRadiusMeters: 200 }));
      state = settingsReducer(state, setValhallaEndpoint('https://custom.example.com/route'));

      // Reset
      const reset = settingsReducer(state, resetSettings());
      expect(reset).toEqual(initialState);
    });

    it('restores privacy defaults after partial update', () => {
      const modified = settingsReducer(initialState, updatePrivacy({ noTelemetry: false }));
      const reset = settingsReducer(modified, resetSettings());
      expect(reset.privacy.noTelemetry).toBe(true);
    });
  });
});
