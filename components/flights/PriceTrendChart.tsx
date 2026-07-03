import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatPrice, type PricePoint } from '@/services/flights';

/**
 * Lightweight bar-based price trend (no external chart library).
 * Bars are scaled between the observed min and max; the cheapest bar is
 * highlighted so users can spot the best time to book.
 */
export function PriceTrendChart({
  points,
  threshold,
  height = 90,
}: {
  points: PricePoint[];
  threshold?: number;
  height?: number;
}) {
  if (points.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>No price history yet</Text>
      </View>
    );
  }

  const prices = points.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = Math.max(1, max - min);

  return (
    <View>
      <View style={[styles.chart, { height }]}>
        {points.map((p, i) => {
          const norm = (p.price - min) / span; // 0..1
          const barHeight = 8 + norm * (height - 16);
          const isLow = p.price === min;
          return (
            <View key={`${p.timestamp}-${i}`} style={styles.barSlot}>
              <View
                style={[
                  styles.bar,
                  { height: barHeight, backgroundColor: isLow ? '#00FF88' : '#1E2744' },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.axis}>
        <Text style={styles.axisText}>Low {formatPrice(min)}</Text>
        {threshold != null ? (
          <Text style={styles.thresholdText}>Alert ≤ {formatPrice(threshold)}</Text>
        ) : null}
        <Text style={styles.axisText}>High {formatPrice(max)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    paddingHorizontal: 2,
  },
  barSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 3 },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  axisText: { color: '#5A5A7A', fontSize: 11 },
  thresholdText: { color: '#00D4FF', fontSize: 11, fontWeight: '600' },
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#5A5A7A', fontSize: 12 },
});
