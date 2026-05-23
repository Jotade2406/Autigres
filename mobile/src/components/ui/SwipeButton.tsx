import React, { useCallback, useRef, useState } from 'react';
import {
  Text, StyleSheet, Animated, PanResponder, Vibration, ViewStyle,
} from 'react-native';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SwipeButtonProps {
  label: string;
  onSwipeComplete: () => void;
  direction?: 'right' | 'left';
  color: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CIRCLE = 44;
const PAD    = 4;
const THRESH = 0.75;

// ── Component ─────────────────────────────────────────────────────────────────

export function SwipeButton({
  label,
  onSwipeComplete,
  direction = 'right',
  color,
  icon,
  disabled = false,
}: SwipeButtonProps) {
  const [completed, setCompleted] = useState(false);

  // Refs — avoid stale closures inside PanResponder
  const maxDxRef     = useRef(0);
  const completedRef = useRef(false);
  const disabledRef  = useRef(disabled);
  disabledRef.current = disabled;

  // Animated values (created once)
  const pan       = useRef(new Animated.Value(0)).current;
  const fillAnim  = useRef(new Animated.Value(0)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;
  // Negated pan for direction='left' (circle starts at right, moves left)
  const negPan    = useRef(Animated.multiply(pan, new Animated.Value(-1))).current;

  // ── Layout ──────────────────────────────────────────────────────────────────

  const handleLayout = useCallback((e: any) => {
    maxDxRef.current = Math.max(0, e.nativeEvent.layout.width - CIRCLE - PAD * 2);
  }, []);

  // ── PanResponder ────────────────────────────────────────────────────────────

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current && !completedRef.current,
      onMoveShouldSetPanResponder:  () => !disabledRef.current && !completedRef.current,

      onPanResponderMove: (_, { dx }) => {
        if (disabledRef.current || completedRef.current) return;
        // raw = positive when moving in the intended direction
        const raw = direction === 'right' ? dx : -dx;
        pan.setValue(Math.max(0, Math.min(raw, maxDxRef.current)));
      },

      onPanResponderRelease: (_, { dx }) => {
        if (disabledRef.current || completedRef.current) return;
        const raw      = direction === 'right' ? dx : -dx;
        const progress = maxDxRef.current > 0
          ? Math.max(0, raw) / maxDxRef.current
          : 0;

        if (progress >= THRESH) {
          // ── Completion ──────────────────────────────────────────────────────
          completedRef.current = true;
          Vibration.vibrate(40);

          Animated.parallel([
            Animated.timing(pan, {
              toValue:         maxDxRef.current,
              duration:        120,
              useNativeDriver: false,
            }),
            Animated.timing(fillAnim, {
              toValue:         1,
              duration:        280,
              useNativeDriver: false,
            }),
          ]).start(() => {
            Animated.spring(checkAnim, {
              toValue:         1,
              tension:         200,
              friction:        7,
              useNativeDriver: true,
            }).start();
            setCompleted(true);
            onSwipeComplete();
          });
        } else {
          // ── Spring back ─────────────────────────────────────────────────────
          Animated.spring(pan, {
            toValue:         0,
            friction:        7,
            tension:         50,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  // ── Derived animated styles ─────────────────────────────────────────────────

  // Track background: color @20% at rest → color @80% when complete
  const trackBg = fillAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [`${color}33`, `${color}CC`],
  });

  // Label fades out as fill completes
  const labelOpacity = fillAnim.interpolate({
    inputRange:  [0, 0.5],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Circle position: left side for direction='right', right side for direction='left'
  const circleBaseStyle: ViewStyle = direction === 'right'
    ? { left: PAD }
    : { right: PAD };

  // Circle x-translation: pan (positive) or negPan (negative) in CSS space
  const circleTx = direction === 'right' ? pan : negPan;

  return (
    <Animated.View
      style={[
        S.track,
        {
          borderColor:     `${color}50`,
          backgroundColor: trackBg,
          opacity:         disabled && !completed ? 0.5 : 1,
        },
      ]}
      onLayout={handleLayout}
      {...panResponder.panHandlers}
    >
      {/* Label (fades out on complete) */}
      {!completed && (
        <Animated.Text
          style={[S.label, { color, opacity: labelOpacity }]}
          numberOfLines={1}
        >
          {label}
        </Animated.Text>
      )}

      {/* Done text (appears after complete) */}
      {completed && (
        <Animated.Text
          style={[S.doneLabel, { color, transform: [{ scale: checkAnim }] }]}
        >
          ¡Listo!
        </Animated.Text>
      )}

      {/* Draggable circle */}
      <Animated.View
        style={[
          S.circle,
          circleBaseStyle,
          {
            backgroundColor: color,
            shadowColor:     color,
            transform:       [{ translateX: circleTx }],
          },
        ]}
      >
        {completed ? (
          <Animated.Text
            style={[S.circleCheck, { transform: [{ scale: checkAnim }] }]}
          >
            ✓
          </Animated.Text>
        ) : icon ? (
          icon
        ) : (
          <Text style={S.circleArrow}>
            {direction === 'right' ? '›' : '‹'}
          </Text>
        )}
      </Animated.View>
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  track: {
    height:         56,
    borderRadius:   28,
    borderWidth:    1,
    justifyContent: 'center',
    alignItems:     'center',
    overflow:       'hidden',
    // relative positioning so absolute circle is constrained inside
    position:       'relative',
  },
  label: {
    fontSize:          14,
    fontWeight:        '600',
    letterSpacing:     0.3,
    textAlign:         'center',
    paddingHorizontal: CIRCLE + 16,
  },
  doneLabel: {
    fontSize:    15,
    fontWeight:  '700',
  },
  circle: {
    position:       'absolute',
    width:          CIRCLE,
    height:         CIRCLE,
    borderRadius:   CIRCLE / 2,
    alignItems:     'center',
    justifyContent: 'center',
    // iOS glow
    shadowOffset:   { width: 0, height: 0 },
    shadowOpacity:  0.65,
    shadowRadius:   10,
    // Android elevation
    elevation:      8,
  },
  circleCheck: {
    fontSize:   20,
    color:      '#fff',
    fontWeight: '800',
  },
  circleArrow: {
    fontSize:   24,
    color:      '#fff',
    fontWeight: '700',
    marginTop:  -2,
  },
});
