import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AccessibilityInfo,
} from 'react-native';
import { useAppSelector, useAppDispatch } from '../../store';
import { clearRoute } from '../../store/slices/routeSlice';
import { formatDistance, formatDuration } from '../../utils/geo';

const MANEUVER_ARROWS: Record<string, string> = {
  left: '←',
  slight_left: '↖',
  sharp_left: '⬅',
  right: '→',
  slight_right: '↗',
  sharp_right: '➡',
  u_turn_left: '↩',
  u_turn_right: '↪',
  roundabout_enter: '⟳',
  roundabout_exit: '⟳',
  destination: '📍',
  start: '●',
  continue: '↑',
  ramp_right: '↗',
  ramp_left: '↖',
  merge: '↑',
  ferry_enter: '⛴',
  ferry_exit: '⛴',
};

export default function TurnByTurn() {
  const dispatch = useAppDispatch();
  const { current: route, navigation, status } = useAppSelector(state => state.route);
  const { units } = useAppSelector(state => state.settings);

  const handleClose = useCallback(() => {
    dispatch(clearRoute());
  }, [dispatch]);

  if (!route || status === 'idle' || status === 'error') return null;

  const currentStep = navigation
    ? route.steps[navigation.currentStepIndex]
    : route.steps[0];

  const nextStep =
    navigation && navigation.currentStepIndex + 1 < route.steps.length
      ? route.steps[navigation.currentStepIndex + 1]
      : null;

  const arrow = MANEUVER_ARROWS[currentStep?.maneuverType ?? 'continue'] ?? '↑';

  return (
    <View style={styles.container} accessibilityLabel="Turn-by-turn navigation">
      {/* Off-route banner */}
      {navigation?.isOffRoute && (
        <View style={styles.offRoute}>
          <Text style={styles.offRouteText}>Recalculating…</Text>
        </View>
      )}

      {/* Current maneuver */}
      <View style={styles.maneuverRow}>
        <Text style={styles.arrow} accessibilityLabel={`Maneuver: ${currentStep?.maneuverType}`}>
          {arrow}
        </Text>
        <View style={styles.maneuverInfo}>
          <Text style={styles.distance}>
            {navigation
              ? formatDistance(navigation.distanceToNextManeuver, units)
              : formatDistance(currentStep?.distance ?? 0, units)}
          </Text>
          <Text style={styles.instruction} numberOfLines={2}>
            {currentStep?.instruction ?? ''}
          </Text>
        </View>
      </View>

      {/* Next step preview */}
      {nextStep && (
        <View style={styles.nextStep}>
          <Text style={styles.nextLabel}>Then </Text>
          <Text style={styles.nextInstruction} numberOfLines={1}>
            {MANEUVER_ARROWS[nextStep.maneuverType] ?? '↑'} {nextStep.instruction}
          </Text>
        </View>
      )}

      {/* Summary bar */}
      <View style={styles.summaryRow}>
        <Text style={styles.summaryText}>
          {navigation
            ? `${formatDuration(navigation.remainingDuration)} · ${formatDistance(navigation.remainingDistance, units)}`
            : `${formatDuration(route.totalDuration)} · ${formatDistance(route.totalDistance, units)}`}
        </Text>
        {route.cameraCount > 0 && (
          <Text style={styles.cameraSummary}>
            {route.cameraCount} camera{route.cameraCount !== 1 ? 's' : ''} avoided
          </Text>
        )}
        <TouchableOpacity onPress={handleClose} accessibilityLabel="Stop navigation" style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1C1C1E',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingTop: 48, // Safe area top
    paddingHorizontal: 16,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  offRoute: {
    backgroundColor: '#FF9500',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  offRouteText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  maneuverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  arrow: {
    fontSize: 40,
    marginRight: 12,
    color: '#FFFFFF',
    width: 52,
    textAlign: 'center',
  },
  maneuverInfo: {
    flex: 1,
  },
  distance: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  instruction: {
    fontSize: 16,
    color: '#EBEBF5CC',
    marginTop: 2,
  },
  nextStep: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#38383A',
    marginBottom: 8,
  },
  nextLabel: {
    fontSize: 14,
    color: '#8E8E93',
  },
  nextInstruction: {
    fontSize: 14,
    color: '#EBEBF5CC',
    flex: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#38383A',
  },
  summaryText: {
    fontSize: 14,
    color: '#8E8E93',
    flex: 1,
  },
  cameraSummary: {
    fontSize: 13,
    color: '#30D158',
    marginRight: 12,
  },
  closeBtn: {
    padding: 4,
  },
  closeText: {
    fontSize: 18,
    color: '#8E8E93',
  },
});
