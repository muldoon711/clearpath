import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type {
  Route,
  RouteStatus,
  NavigationState,
  LatLng,
  TravelMode,
  SearchResult,
} from '../../types';
import ValhallaRouter from '../../services/ValhallaRouter';
import CameraDatabase from '../../services/CameraDatabase';
import type { RootState } from '../index';

interface RouteSliceState {
  current: Route | null;
  status: RouteStatus;
  error: string | null;
  destination: LatLng | null;
  navigation: NavigationState | null;
  pendingDestination: SearchResult | null;
}

const initialState: RouteSliceState = {
  current: null,
  status: 'idle',
  error: null,
  destination: null,
  navigation: null,
  pendingDestination: null,
};

export const calculateRoute = createAsyncThunk<
  Route,
  { origin: LatLng; destination: LatLng; travelMode: TravelMode },
  { state: RootState; rejectValue: string }
>('route/calculate', async ({ origin, destination, travelMode }, { getState, rejectWithValue }) => {
  const state = getState();
  const { avoidance, routeOptions } = state.settings;

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

  const avoidCameras = cameras.filter((c) => vendorsToAvoid.has(c.vendor) && c.status === 'active');

  const router = ValhallaRouter.getInstance();
  const routerOpts = {
    origin,
    destination,
    travelMode,
    avoidRadiusMeters: avoidance.avoidRadiusMeters,
    endpoint: state.settings.valhallaEndpoint,
    avoidTolls: routeOptions?.avoidTolls,
    avoidHighways: routeOptions?.avoidHighways,
    avoidFerries: routeOptions?.avoidFerries,
  };

  // Try with camera avoidance first; fall back to standard routing if Valhalla
  // can't find a camera-free path (so navigation always starts).
  let route = await router.route({ ...routerOpts, avoidCameras });
  if (!route && avoidCameras.length > 0) {
    route = await router.route({ ...routerOpts, avoidCameras: [] });
  }

  if (!route) {
    return rejectWithValue('No route found. Check your connection and try again.');
  }
  return route;
});

const routeSlice = createSlice({
  name: 'route',
  initialState,
  reducers: {
    clearRoute(state) {
      state.current = null;
      state.status = 'idle';
      state.error = null;
      state.destination = null;
      state.navigation = null;
    },
    setPendingDestination(state, action: PayloadAction<SearchResult | null>) {
      state.pendingDestination = action.payload;
    },
    setDestination(state, action: PayloadAction<LatLng | null>) {
      state.destination = action.payload;
    },
    updateNavigation(state, action: PayloadAction<NavigationState>) {
      state.navigation = action.payload;
      if (state.current) {
        state.status = 'active';
      }
    },
    setArrived(state) {
      state.status = 'arrived';
      state.navigation = null;
    },
    setCurrentRoute(state, action: PayloadAction<Route>) {
      state.current = action.payload;
      state.status = 'active';
      state.destination = action.payload.destination;
      state.error = null;
      state.navigation = null;
    },
    setOffRoute(state, action: PayloadAction<boolean>) {
      if (state.navigation) {
        state.navigation.isOffRoute = action.payload;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(calculateRoute.pending, (state) => {
        state.status = 'calculating';
        state.error = null;
      })
      .addCase(calculateRoute.fulfilled, (state, action) => {
        state.current = action.payload;
        state.status = 'active';
        state.error = null;
      })
      .addCase(calculateRoute.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.payload ?? 'Route calculation failed';
      });
  },
});

export const {
  clearRoute,
  setPendingDestination,
  setCurrentRoute,
  setDestination,
  updateNavigation,
  setArrived,
  setOffRoute,
} = routeSlice.actions;

export default routeSlice.reducer;
