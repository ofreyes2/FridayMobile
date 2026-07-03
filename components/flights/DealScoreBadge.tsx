import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { FlightResult } from '@/services/flights';

const LABELS: Record<FlightResult['dealLabel'], { text: string; color: string; bg: string }> = {
  great: { text: 'Great deal', color: '#00FF88', bg: 'rgba(0,255,136,0.12)' },
  good: { text: 'Good deal', color: '#00D4FF', bg: 'rgba(0,212,255,0.12)' },
  typical: { text: 'Typical', color: '#8888AA', bg: 'rgba(136,136,170,0.12)' },
  high: { text: 'High', color: '#FFB800', bg: 'rgba(255,184,0,0.12)' },
};

export function DealScoreBadge({ label }: { label: FlightResult['dealLabel'] }) {
  const s = LABELS[label];
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.text, { color: s.color }]}>{s.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
