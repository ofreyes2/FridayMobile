import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  AIRLINES,
  formatDuration,
  formatPrice,
  formatTime,
  stopsLabel,
  type FlightResult,
} from '@/services/flights';
import { DealScoreBadge } from './DealScoreBadge';

interface Props {
  result: FlightResult;
  passengers?: number;
  tag?: string; // e.g. "Cheapest", "Fastest"
}

export function FlightResultCard({ result, passengers = 1, tag }: Props) {
  const first = result.segments[0];
  const last = result.segments[result.segments.length - 1];
  const airlineNames = result.airlines
    .map((c) => AIRLINES[c]?.name ?? c)
    .join(' + ');
  const total = result.totalPrice * passengers;
  const wnPoints = result.loyaltyPoints.WN;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.airlineWrap}>
          <Text style={styles.airline}>{airlineNames}</Text>
          {tag ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.priceWrap}>
          <Text style={styles.price}>{formatPrice(total)}</Text>
          {passengers > 1 ? (
            <Text style={styles.perPax}>{formatPrice(result.totalPrice)}/traveler</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.routeRow}>
        <View style={styles.endpoint}>
          <Text style={styles.time}>{formatTime(first.departTime)}</Text>
          <Text style={styles.code}>{first.origin}</Text>
        </View>

        <View style={styles.middle}>
          <Text style={styles.duration}>{formatDuration(result.durationMinutes)}</Text>
          <View style={styles.line}>
            <View style={styles.dot} />
            {result.stops > 0 ? <View style={styles.midDot} /> : null}
            <View style={styles.dot} />
          </View>
          <Text style={styles.stops}>{stopsLabel(result.stops)}</Text>
        </View>

        <View style={[styles.endpoint, styles.endRight]}>
          <Text style={styles.time}>{formatTime(last.arriveTime)}</Text>
          <Text style={styles.code}>{last.destination}</Text>
        </View>
      </View>

      {result.stops > 0 ? (
        <Text style={styles.via}>
          via {result.segments.slice(0, -1).map((s) => s.destination).join(', ')}
        </Text>
      ) : null}

      <View style={styles.footerRow}>
        <DealScoreBadge label={result.dealLabel} />
        {wnPoints ? (
          <Text style={styles.points}>+{wnPoints.toLocaleString()} RR pts</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#12121A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E1E2E',
    padding: 14,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  airlineWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  airline: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  tag: {
    backgroundColor: 'rgba(0,212,255,0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  tagText: { color: '#00D4FF', fontSize: 10, fontWeight: '700' },
  priceWrap: { alignItems: 'flex-end' },
  price: { color: '#00FF88', fontSize: 20, fontWeight: '800' },
  perPax: { color: '#5A5A7A', fontSize: 11, marginTop: 1 },
  routeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  endpoint: { alignItems: 'flex-start', width: 64 },
  endRight: { alignItems: 'flex-end' },
  time: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  code: { color: '#8888AA', fontSize: 12, marginTop: 2 },
  middle: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  duration: { color: '#8888AA', fontSize: 11, marginBottom: 3 },
  line: { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00D4FF' },
  midDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#5A5A7A',
    marginHorizontal: 24,
  },
  stops: { color: '#5A5A7A', fontSize: 11, marginTop: 3 },
  via: { color: '#5A5A7A', fontSize: 11, marginTop: 8 },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  points: { color: '#FFB800', fontSize: 12, fontWeight: '600' },
});
