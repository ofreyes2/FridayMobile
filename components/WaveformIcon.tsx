import React, { useEffect } from 'react';
import { View, Animated } from 'react-native';

interface WaveformIconProps {
  isActive: boolean;
  size?: number;
}

export function WaveformIcon({ isActive, size = 24 }: WaveformIconProps) {
  const bar1Height = new Animated.Value(0.4);
  const bar2Height = new Animated.Value(0.6);
  const bar3Height = new Animated.Value(0.8);
  const bar4Height = new Animated.Value(0.5);

  useEffect(() => {
    if (!isActive) {
      // Reset to default heights when inactive
      Animated.parallel([
        Animated.timing(bar1Height, {
          toValue: 0.4,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(bar2Height, {
          toValue: 0.6,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(bar3Height, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(bar4Height, {
          toValue: 0.5,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start();
      return;
    }

    // Animate bars when active
    const animation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(bar1Height, {
            toValue: 1,
            duration: 300,
            useNativeDriver: false,
          }),
          Animated.timing(bar1Height, {
            toValue: 0.4,
            duration: 300,
            useNativeDriver: false,
          }),
        ]),
        Animated.sequence([
          Animated.timing(bar2Height, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: false,
          }),
          Animated.timing(bar2Height, {
            toValue: 0.8,
            duration: 400,
            useNativeDriver: false,
          }),
        ]),
        Animated.sequence([
          Animated.timing(bar3Height, {
            toValue: 0.7,
            duration: 350,
            useNativeDriver: false,
          }),
          Animated.timing(bar3Height, {
            toValue: 0.5,
            duration: 350,
            useNativeDriver: false,
          }),
        ]),
        Animated.sequence([
          Animated.timing(bar4Height, {
            toValue: 0.9,
            duration: 380,
            useNativeDriver: false,
          }),
          Animated.timing(bar4Height, {
            toValue: 0.3,
            duration: 380,
            useNativeDriver: false,
          }),
        ]),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [isActive, bar1Height, bar2Height, bar3Height, bar4Height]);

  const barWidth = size * 0.12;
  const barSpacing = size * 0.1;
  const maxBarHeight = size * 0.8;
  const color = isActive ? '#00D4FF' : '#888888';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: barSpacing }}>
      <Animated.View
        style={{
          width: barWidth,
          height: bar1Height.interpolate({
            inputRange: [0, 1],
            outputRange: [maxBarHeight * 0.3, maxBarHeight],
          }),
          backgroundColor: color,
          borderRadius: barWidth / 2,
        }}
      />
      <Animated.View
        style={{
          width: barWidth,
          height: bar2Height.interpolate({
            inputRange: [0, 1],
            outputRange: [maxBarHeight * 0.3, maxBarHeight],
          }),
          backgroundColor: color,
          borderRadius: barWidth / 2,
        }}
      />
      <Animated.View
        style={{
          width: barWidth,
          height: bar3Height.interpolate({
            inputRange: [0, 1],
            outputRange: [maxBarHeight * 0.3, maxBarHeight],
          }),
          backgroundColor: color,
          borderRadius: barWidth / 2,
        }}
      />
      <Animated.View
        style={{
          width: barWidth,
          height: bar4Height.interpolate({
            inputRange: [0, 1],
            outputRange: [maxBarHeight * 0.3, maxBarHeight],
          }),
          backgroundColor: color,
          borderRadius: barWidth / 2,
        }}
      />
    </View>
  );
}
