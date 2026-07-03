import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AirportPicker } from '@/components/flights/AirportPicker';
import {
  airportLabel,
  formatDuration,
  formatPrice,
  southwestOptimizer,
  type SouthwestFlight,
  type SouthwestOptimizerResponse,
} from '@/services/flights';

function todayPlus(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

export default function SouthwestScreen() {
  const [origin, setOrigin] = useState('MDW');
  const [departDate, setDepartDate] = useState(todayPlus(14));
  const [rangeDays, setRangeDays] = useState('7');
  const [tierGoal, setTierGoal] = useState<'a_list' | 'companion'>('companion');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SouthwestOptimizerResponse | null>(null);

  const target = useMemo(() => {
    if (!data) return 0;
    return tierGoal === 'companion' ? data.companionPassTarget : data.aListTarget;
  }, [data, tierGoal]);

  const onOptimize = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await southwestOptimizer({
        origins: origin ? [origin] : [],
        departDate,
        dateRangeDays: Math.max(1, Math.min(21, Number(rangeDays) || 7)),
      });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Optimizer failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        Rack up Rapid Rewards tier and Companion Pass points with cheap short-haul hops, ranked
        by points per dollar.
      </Text>

      <AirportPicker label="Home airport" value={origin} onChange={setOrigin} />

      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.label}>From date</Text>
          <TextInput
            style={styles.input}
            value={departDate}
            onChangeText={setDepartDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#5A5A7A"
          />
        </View>
        <View style={styles.gap} />
        <View style={styles.flex}>
          <Text style={styles.label}>Scan days</Text>
          <TextInput
            style={styles.input}
            value={rangeDays}
            onChangeText={setRangeDays}
            keyboardType="numeric"
            placeholder="7"
            placeholderTextColor="#5A5A7A"
          />
        </View>
      </View>

      <Text style={styles.label}>Goal</Text>
      <View style={styles.chipRow}>
        <Pressable
          style={[styles.chip, tierGoal === 'companion' && styles.chipOn]}
          onPress={() => setTierGoal('companion')}
        >
          <Text style={[styles.chipText, tierGoal === 'companion' && styles.chipTextOn]}>
            Companion Pass
          </Text>
        </Pressable>
        <Pressable
          style={[styles.chip, tierGoal === 'a_list' && styles.chipOn]}
          onPress={() => setTierGoal('a_list')}
        >
          <Text style={[styles.chipText, tierGoal === 'a_list' && styles.chipTextOn]}>
            A-List tier
          </Text>
        </Pressable>
      </View>

      <Pressable style={styles.optBtn} onPress={onOptimize} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#0A0A0F" />
        ) : (
          <Text style={styles.optBtnText}>Find status-friendly flights</Text>
        )}
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {data ? (
        <View style={styles.goalCard}>
          <Text style={styles.goalTitle}>
            {tierGoal === 'companion' ? 'Companion Pass' : 'A-List'} target
          </Text>
          <Text style={styles.goalTarget}>{target.toLocaleString()} pts / year</Text>
          <Text style={styles.goalHint}>
            Best value:{' '}
            {data.bestValueItineraryId
              ? bestLabel(data.flights, data.bestValueItineraryId)
              : '—'}
          </Text>
        </View>
      ) : null}

      {data?.flights.map((f) => (
        <SwCard key={f.itineraryId} flight={f} isBest={f.itineraryId === data.bestValueItineraryId} />
      ))}

      {data && data.flights.length === 0 ? (
        <Text style={styles.empty}>No short hops found. Try a different home airport.</Text>
      ) : null}
    </ScrollView>
  );
}

function bestLabel(flights: SouthwestFlight[], id: string): string {
  const f = flights.find((x) => x.itineraryId === id);
  if (!f) return '—';
  return `${f.origin} → ${f.destination} (${(f.tierPoints / f.price).toFixed(1)} pts/$)`;
}

function SwCard({ flight, isBest }: { flight: SouthwestFlight; isBest: boolean }) {
  return (
    <View style={[styles.swCard, isBest && styles.swCardBest]}>
      <View style={styles.swHeader}>
        <View>
          <Text style={styles.swRoute}>
            {flight.origin} → {flight.destination}
          </Text>
          <Text style={styles.swMeta}>
            {airportLabel(flight.destination)} · {formatDuration(flight.durationMinutes)} ·{' '}
            {flight.departDate}
          </Text>
        </View>
        <Text style={styles.swPrice}>{formatPrice(flight.price)}</Text>
      </View>
      {isBest ? (
        <View style={styles.bestTag}>
          <Text style={styles.bestTagText}>Best value</Text>
        </View>
      ) : null}
      <View style={styles.swStats}>
        <Stat label="Tier pts" value={flight.tierPoints.toLocaleString()} accent="#FFB800" />
        <Stat label="Companion pts" value={flight.companionPoints.toLocaleString()} accent="#00D4FF" />
        <Stat label="Pts / $" value={(flight.tierPoints / flight.price).toFixed(1)} accent="#00FF88" />
      </View>
    </View>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  content: { padding: 16, paddingBottom: 48 },
  intro: { color: '#8888AA', fontSize: 14, lineHeight: 20, marginBottom: 16 },
  row: { flexDirection: 'row', marginTop: 4 },
  gap: { width: 12 },
  flex: { flex: 1 },
  label: { color: '#8888AA', fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#12121A',
    borderWidth: 1,
    borderColor: '#1E1E2E',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 15,
  },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#12121A',
    borderWidth: 1,
    borderColor: '#1E1E2E',
  },
  chipOn: { backgroundColor: 'rgba(255,184,0,0.15)', borderColor: '#FFB800' },
  chipText: { color: '#8888AA', fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: '#FFB800' },
  optBtn: {
    backgroundColor: '#FFB800',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  optBtnText: { color: '#0A0A0F', fontSize: 16, fontWeight: '800' },
  error: { color: '#FF4466', fontSize: 14, marginTop: 14, textAlign: 'center' },
  goalCard: {
    backgroundColor: '#12121A',
    borderWidth: 1,
    borderColor: '#FFB800',
    borderRadius: 14,
    padding: 16,
    marginTop: 24,
    marginBottom: 16,
  },
  goalTitle: { color: '#FFB800', fontSize: 13, fontWeight: '700' },
  goalTarget: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', marginTop: 4 },
  goalHint: { color: '#8888AA', fontSize: 13, marginTop: 6 },
  swCard: {
    backgroundColor: '#12121A',
    borderWidth: 1,
    borderColor: '#1E1E2E',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  swCardBest: { borderColor: '#00FF88' },
  swHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  swRoute: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  swMeta: { color: '#8888AA', fontSize: 12, marginTop: 3 },
  swPrice: { color: '#00FF88', fontSize: 20, fontWeight: '800' },
  bestTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,255,136,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 8,
  },
  bestTagText: { color: '#00FF88', fontSize: 11, fontWeight: '700' },
  swStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    borderTopWidth: 1,
    borderColor: '#1E1E2E',
    paddingTop: 12,
  },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 17, fontWeight: '800' },
  statLabel: { color: '#5A5A7A', fontSize: 11, marginTop: 3 },
  empty: { color: '#5A5A7A', fontSize: 14, textAlign: 'center', marginTop: 24 },
});
