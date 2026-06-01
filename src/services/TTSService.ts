import type { Units } from '../types';

// react-native-tts is optional — if not available (e.g. simulator without audio),
// all calls are silently no-ops.
let Tts: {
  speak: (s: string) => void;
  stop: () => void;
  setDefaultLanguage: (l: string) => void;
  setDefaultRate: (r: number) => void;
} | null = null;
try {
  Tts = require('react-native-tts').default;
  Tts!.setDefaultLanguage('en-US');
  Tts!.setDefaultRate(0.5);
} catch {
  // TTS not available
}

export default class TTSService {
  private static instance: TTSService;

  private lastAnnouncedStepIndex = -1;
  private lastAnnouncedThreshold: 'far' | 'close' | 'now' | null = null;
  private lastCameraAnnouncedAt = -1;

  private constructor() {}

  static getInstance(): TTSService {
    if (!TTSService.instance) TTSService.instance = new TTSService();
    return TTSService.instance;
  }

  private speak(text: string) {
    if (!Tts) return;
    Tts.stop();
    Tts.speak(text);
  }

  private formatDistance(meters: number, units: Units): string {
    if (units === 'metric') {
      if (meters >= 1000) return `${(meters / 1000).toFixed(1)} kilometers`;
      return `${Math.round(meters)} meters`;
    }
    const feet = meters * 3.28084;
    if (feet >= 1000) {
      const miles = feet / 5280;
      return miles < 1.5 ? `${miles.toFixed(1)} miles` : `${Math.round(miles)} miles`;
    }
    // Round to nearest 100 ft for the announcement
    return `${Math.round(feet / 100) * 100} feet`;
  }

  checkManeuver(stepIndex: number, distanceMeters: number, instruction: string, units: Units) {
    if (stepIndex !== this.lastAnnouncedStepIndex) {
      this.lastAnnouncedStepIndex = stepIndex;
      this.lastAnnouncedThreshold = null;
    }

    if (distanceMeters <= 20 && this.lastAnnouncedThreshold !== 'now') {
      this.lastAnnouncedThreshold = 'now';
      this.speak(instruction);
    } else if (
      distanceMeters > 20 &&
      distanceMeters <= 200 &&
      this.lastAnnouncedThreshold !== 'close' &&
      this.lastAnnouncedThreshold !== 'now'
    ) {
      this.lastAnnouncedThreshold = 'close';
      this.speak(`In ${this.formatDistance(distanceMeters, units)}, ${instruction}`);
    } else if (
      distanceMeters > 200 &&
      distanceMeters <= 600 &&
      this.lastAnnouncedThreshold !== 'far' &&
      this.lastAnnouncedThreshold !== 'close' &&
      this.lastAnnouncedThreshold !== 'now'
    ) {
      this.lastAnnouncedThreshold = 'far';
      this.speak(`In ${this.formatDistance(distanceMeters, units)}, ${instruction}`);
    }
  }

  announceCamera(distanceMeters: number, warningDistanceMeters: number) {
    // Only announce once per camera approach window
    if (
      distanceMeters <= warningDistanceMeters &&
      distanceMeters > warningDistanceMeters - 80 &&
      Math.abs(distanceMeters - this.lastCameraAnnouncedAt) > 50
    ) {
      this.lastCameraAnnouncedAt = distanceMeters;
      this.speak('Speed camera ahead');
    }
  }

  announceArrival() {
    this.speak('You have arrived at your destination');
  }

  reset() {
    this.lastAnnouncedStepIndex = -1;
    this.lastAnnouncedThreshold = null;
    this.lastCameraAnnouncedAt = -1;
  }
}
