import React, { useState } from 'react';
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
import { FlightResultCard } from '@/components/flights/FlightResultCard';
import {
  buildConnection,
  formatDuration,
  formatPrice,
  type ConnectionPlan,
} from '@/services/flights';

function todayPlus(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

export default function BuilderScreen() {
  const [stops, setStops] = useState<string[]>(['ORD', 'DEN', 'LAS', 'PHX', 'ORD']);
  const [departDate, setDepartDate] = useState(todayPlus(30));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<ConnectionPlan | null>(null);

  const setStop = (i: number, code: string) =>
    setStops((prev) => prev.map((s, idx) => (idx === i ? code : s)));
  const addStop = () => setStops((prev) => [...prev, '']);
  const removeStop = (i: number) =>
    setStops((prev) => (prev.length > 2 ? prev.filter((_, idx) => idx !== i) : prev));

  const onBuild = async () => {
    setLoading(true);
    setError(null);
    setPlan(null);
    try {
      const codes = stops.filter(Boolean);
      const result = await buildConnection(codes, departDate);
      setPlan(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build itinerary');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        Chain cheap short hops into one itinerary. We price each leg and compare it to flying
        direct.
      </Text>

      {stops.map((code, i) => (
        <View key={i} style={styles.stopRow}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>{i + 1}</Text>
          </View>
          <View style={styles.flex}>
            <AirportPicker
              label={i === 0 ? 'Start' : i === stops.length - 1 ? 'End' : `Stop ${i}`}
              value={code}
              onChange={(c) => setStop(i, c)}
            />
          </View>
          {stops.length > 2 ? (
            <Pressable style={styles.removeBtn} onPress={() => removeStop(i)} hitSlop={8}>
              <Text style={styles.removeText}>✕</Text>
            </Pressable>
          ) : null}
        </View>
      ))}

      <Pressable style={styles.addBtn} onPress={addStop}>
        <Text style={styles.addText}>+ Add stop</Text>
      </Pressable>

      <Text style={styles.label}>Depart date</Text>
      <TextInput
        style={styles.input}
        value={departDate}
        onChangeText={setDepartDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor="#5A5A7A"
      />

      <Pressable style={styles.buildBtn} onPress={onBuild} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#0A0A0F" />
        ) : (
          <Text style={styles.buildBtnText}>Build itinerary</Text>
        )}
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {plan ? (
        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.summaryLabel}>Connection total</Text>
              <Text style={styles.summaryPrice}>{formatPrice(plan.totalPrice)}</Text>
            </View>
            <View style={styles.summaryRight}>
              <Text style={styles.summaryLabel}>Direct est.</Text>
              <Text style={styles.summaryDirect}>{formatPrice(plan.directPrice)}</Text>
            </View>
          </View>
          <View style={styles.summaryMetaRow}>
            <Text style={styles.summaryMeta}>
              {formatDuration(plan.totalDurationMinutes)} · {plan.totalStops} stops total
            </Text>
            {plan.savings > 0 ? (
              <Text style={styles.savings}>Save {formatPrice(plan.savings)}</Text>
            ) : (
              <Text style={styles.noSavings}>Direct is cheaper</Text>
            )}
          </View>
        </View>
      ) : null}

      {plan?.legs.map((leg, i) => (
        <View key={leg.itineraryId + i}>
          <Text style={styles.legLabel}>
            Leg {i + 1}: {plan.stops[i]} → {plan.stops[i + 1]}
          </Text>
          <FlightResultCard result={leg} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  content: { padding: 16, paddingBottom: 48 },
  intro: { color: '#8888AA', fontSize: 14, lineHeight: 20, marginBottom: 16 },
  stopRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10, gap: 10 },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1E2744',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  stepBadgeText: { color: '#00D4FF', fontSize: 13, fontWeight: '800' },
  flex: { flex: 1 },
  removeBtn: {
    width: 34,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  removeText: { color: '#FF4466', fontSize: 16, fontWeight: '700' },
  addBtn: {
    borderWidth: 1,
    borderColor: '#1E2744',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  addText: { color: '#00D4FF', fontSize: 14, fontWeight: '600' },
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
  buildBtn: {
    backgroundColor: '#0096FF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  buildBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  error: { color: '#FF4466', fontSize: 14, marginTop: 14, textAlign: 'center' },
  summary: {
    backgroundColor: '#12121A',
    borderWidth: 1,
    borderColor: '#0096FF',
    borderRadius: 14,
    padding: 16,
    marginTop: 24,
    marginBottom: 16,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  summaryRight: { alignItems: 'flex-end' },
  summaryLabel: { color: '#8888AA', fontSize: 12, marginBottom: 4 },
  summaryPrice: { color: '#00FF88', fontSize: 26, fontWeight: '800' },
  summaryDirect: { color: '#8888AA', fontSize: 18, fontWeight: '700', textDecorationLine: 'line-through' },
  summaryMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  summaryMeta: { color: '#8888AA', fontSize: 13 },
  savings: { color: '#00FF88', fontSize: 14, fontWeight: '800' },
  noSavings: { color: '#FFB800', fontSize: 13, fontWeight: '600' },
  legLabel: { color: '#00D4FF', fontSize: 13, fontWeight: '700', marginTop: 8, marginBottom: 6 },
});
