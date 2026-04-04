/**
 * Animated typing indicator while Friday is thinking
 */
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';

export function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.loop(
        Animated.sequence([
          Animated.timing(dot1, {
            toValue: 1,
            duration: 400,
            useNativeDriver: false,
          }),
          Animated.timing(dot1, {
            toValue: 0,
            duration: 400,
            useNativeDriver: false,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.delay(150),
          Animated.timing(dot2, {
            toValue: 1,
            duration: 400,
            useNativeDriver: false,
          }),
          Animated.timing(dot2, {
            toValue: 0,
            duration: 400,
            useNativeDriver: false,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.delay(300),
          Animated.timing(dot3, {
            toValue: 1,
            duration: 400,
            useNativeDriver: false,
          }),
          Animated.timing(dot3, {
            toValue: 0,
            duration: 400,
            useNativeDriver: false,
          }),
        ])
      ),
    ]).start();
  }, [dot1, dot2, dot3]);

  const getOpacity = (dot: Animated.Value) =>
    dot.interpolate({
      inputRange: [0, 1],
      outputRange: [0.4, 1],
    });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[styles.dot, { opacity: getOpacity(dot1) }]}
      />
      <Animated.View
        style={[styles.dot, { opacity: getOpacity(dot2) }]}
      />
      <Animated.View
        style={[styles.dot, { opacity: getOpacity(dot3) }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
});
