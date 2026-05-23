import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, PanResponder, Animated, StyleProp, ViewStyle,
} from 'react-native';

interface SwipeSliderProps {
  label: string;
  direction: 'right' | 'left';
  color: string;
  onComplete: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const TRACK_H = 64;
const THUMB   = 56;
const PAD     = 4;
const THRESH  = 0.70;

export function SwipeSlider({
  label, direction, color, onComplete, disabled = false, style,
}: SwipeSliderProps) {
  const widthRef      = useRef(0);
  const doneRef       = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const disabledRef   = useRef(disabled);
  const [ready, setReady] = useState(false);

  onCompleteRef.current = onComplete;
  disabledRef.current   = disabled;

  const translateX = useRef(new Animated.Value(0)).current;

  const getMax = () => Math.max(0, widthRef.current - THUMB - PAD * 2);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current && !doneRef.current,
      onMoveShouldSetPanResponder:  () => !disabledRef.current && !doneRef.current,
      onPanResponderMove: (_, g) => {
        const max = getMax();
        const raw = direction === 'right' ? g.dx : max + g.dx;
        translateX.setValue(Math.max(0, Math.min(raw, max)));
      },
      onPanResponderRelease: (_, g) => {
        const max = getMax();
        const triggered = direction === 'right'
          ? g.dx > max * THRESH
          : g.dx < -(max * THRESH);
        if (triggered && !doneRef.current) {
          doneRef.current = true;
          Animated.spring(translateX, {
            toValue: direction === 'right' ? max : 0,
            useNativeDriver: true,
            bounciness: 4, speed: 28,
          }).start(() => onCompleteRef.current());
        } else {
          Animated.spring(translateX, {
            toValue: direction === 'right' ? 0 : max,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Fade the label as thumb moves into its zone
  const labelOpacity = translateX.interpolate({
    inputRange:  direction === 'right' ? [0, 80] : [0, 80],
    outputRange: direction === 'right' ? [1, 0.1] : [0.1, 1],
    extrapolate: 'clamp',
  });

  // Arrows that pulse to hint direction
  const arrows = direction === 'right' ? ['›', '›', '›'] : ['‹', '‹', '‹'];

  return (
    <View
      style={[S.track, { borderColor: color + '80' }, style]}
      onLayout={e => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && widthRef.current !== w) {
          widthRef.current = w;
          doneRef.current  = false;
          translateX.setValue(direction === 'left' ? w - THUMB - PAD * 2 : 0);
          setReady(true);
        }
      }}
    >
      {/* Track background tint */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: color + '18', borderRadius: TRACK_H / 2 }]} />

      {/* Direction hint arrows */}
      <Animated.View
        style={[
          S.arrowRow,
          direction === 'right' ? S.arrowRowRight : S.arrowRowLeft,
          { opacity: labelOpacity },
        ]}
        pointerEvents="none"
      >
        {arrows.map((a, i) => (
          <Text key={i} style={[S.arrowHint, { color }]}>{a}</Text>
        ))}
      </Animated.View>

      {/* Center label */}
      <Animated.Text style={[S.label, { opacity: labelOpacity }]} numberOfLines={1} pointerEvents="none">
        {label}
      </Animated.Text>

      {/* Draggable thumb */}
      {ready && (
        <Animated.View
          style={[S.thumb, { backgroundColor: color, transform: [{ translateX }] }]}
          {...panResponder.panHandlers}
        >
          <Text style={S.thumbArrow}>{direction === 'right' ? '▶' : '◀'}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  track: {
    height:         TRACK_H,
    borderRadius:   TRACK_H / 2,
    borderWidth:    1.5,
    overflow:       'visible',
    justifyContent: 'center',
    alignItems:     'center',
  },
  arrowRow: {
    position:      'absolute',
    flexDirection: 'row',
    alignItems:    'center',
    gap:           2,
  },
  arrowRowRight: { right: 18 },
  arrowRowLeft:  { left: 18  },
  arrowHint:  { fontSize: 22, fontWeight: '300' },
  label: {
    fontSize:   14,
    fontWeight: '700',
    color:      '#E0E0E0',
    textAlign:  'center',
    paddingHorizontal: THUMB + 24,
  },
  thumb: {
    position:       'absolute',
    left:           PAD,
    top:            PAD,
    width:          THUMB,
    height:         THUMB,
    borderRadius:   THUMB / 2,
    alignItems:     'center',
    justifyContent: 'center',
    zIndex:         10,
    shadowColor:    '#000',
    shadowOffset:   { width: 0, height: 3 },
    shadowOpacity:  0.3,
    shadowRadius:   4,
    elevation:      6,
  },
  thumbArrow: { fontSize: 22, fontWeight: '800', color: '#fff' },
});
