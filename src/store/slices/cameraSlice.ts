import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { ALPRCamera, SyncState, BoundingBox } from '../../types';
import DeflockSync from '../../services/DeflockSync';
import CameraDatabase from '../../services/CameraDatabase';
import type { RootState } from '../index';

interface CameraSliceState {
  visibleCameras: ALPRCamera[];
  sync: SyncState;
  selectedCameraId: string | null;
}

const initialState: CameraSliceState = {
  visibleCameras: [],
  sync: {
    status: 'idle',
    lastSync: null,
    cameraCount: 0,
    error: null,
  },
  selectedCameraId: null,
};

export const syncCameras = createAsyncThunk<
  { count: number; timestamp: string },
  void,
  { state: RootState; rejectValue: string }
>('cameras/sync', async (_, { getState, rejectWithValue }) => {
  const { deflockEndpoint } = getState().settings;
  const sync = DeflockSync.getInstance();

  const result = await sync.fetchAndStore(deflockEndpoint);
  if (!result.success) {
    return rejectWithValue(result.error ?? 'Sync failed');
  }
  return { count: result.count, timestamp: result.timestamp };
});

export const loadVisibleCameras = createAsyncThunk<ALPRCamera[], BoundingBox>(
  'cameras/loadVisible',
  async (bounds) => {
    return CameraDatabase.getInstance().getCamerasInBounds(bounds);
  },
);

const cameraSlice = createSlice({
  name: 'cameras',
  initialState,
  reducers: {
    selectCamera(state, action: PayloadAction<string | null>) {
      state.selectedCameraId = action.payload;
    },
    clearVisibleCameras(state) {
      state.visibleCameras = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(syncCameras.pending, (state) => {
        state.sync.status = 'syncing';
        state.sync.error = null;
      })
      .addCase(syncCameras.fulfilled, (state, action) => {
        state.sync.status = 'success';
        state.sync.lastSync = action.payload.timestamp;
        state.sync.cameraCount = action.payload.count;
        state.sync.error = null;
      })
      .addCase(syncCameras.rejected, (state, action) => {
        state.sync.status = 'error';
        state.sync.error = action.payload ?? 'Unknown error';
      })
      .addCase(loadVisibleCameras.fulfilled, (state, action) => {
        state.visibleCameras = action.payload;
      });
  },
});

export const { selectCamera, clearVisibleCameras } = cameraSlice.actions;
export default cameraSlice.reducer;
