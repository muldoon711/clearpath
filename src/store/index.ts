import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';
import {
  persistStore,
  persistReducer,
  createMigrate,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { combineReducers } from 'redux';

import mapReducer from './slices/mapSlice';
import routeReducer from './slices/routeSlice';
import cameraReducer from './slices/cameraSlice';
import settingsReducer from './slices/settingsSlice';

const rootReducer = combineReducers({
  map: mapReducer,
  route: routeReducer,
  cameras: cameraReducer,
  settings: settingsReducer,
});

// Bump version when the settings shape changes — migrations backfill missing fields
// so existing installs don't crash on rehydration.
const migrations = {
  1: (state: any) => ({
    ...state,
    settings: {
      ...state?.settings,
      routeOptions: state?.settings?.routeOptions ?? {
        avoidTolls: false,
        avoidHighways: false,
        avoidFerries: false,
      },
    },
  }),
};

const persistConfig = {
  key: 'clearpath_root',
  version: 1,
  storage: AsyncStorage,
  whitelist: ['settings'],
  migrate: createMigrate(migrations as any, { debug: false }),
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
