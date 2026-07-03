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
import { DealScoreBadge } from '@/components/flights/DealScoreBadge';
import {
  cheapestAnywhere,
  formatDuration,
  formatPrice,
  REGIONS,
  stopsLabel,
  type CheapestDestination,
} from '@/services/flights';

function todayPlus(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

type ViewMode = 'list' | 'bubbles';

export default function ExploreScreen() {
  const [origin, setOrigin] = useState('ORD');
  const [departDate, setDepartDate] = useState(todayPlus(28));
  const [region, setRegion] = useState<string | undefined>(undefined);
  const [maxPrice, setMaxPrice] = useState('');
  const [mode, setMode] = useState<ViewMode>('list');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<CheapestDestination[]>([]);

  const onExplore = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await cheapestAnywhere({
        origins: origin ? [origin] : [],
        departDate,
        passengers: { adults: 1, children: 0 },
        region,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        limit: 48,
      });
      setRows(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Explore failed');
    } finally {
      setLoading(false);
    }
  };

  const cheapest = rows[0]?.price;
  const priciest = rows[rows.length - 1]?.price;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <AirportPicker label="From" value={origin} onChange={setOrigin} />

      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.label}>Depart date</Text>
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
          <Text style={styles.label}>Max price</Text>
          <TextInput
            style={styles.input}
            value={maxPrice}
            onChangeText={setMaxPrice}
            keyboardType="numeric"
            placeholder="Any"
            placeholderTextColor="#5A5A7A"
          />
        </View>
      </View>

      <Text style={styles.label}>Region</Text>
      <View style={styles.chipRow}>
        <Pressable
          style={[styles.chip, region === undefined && styles.chipOn]}
          onPress={() => setRegion(undefined)}
        >
          <Text style={[styles.chipText, region === undefined && styles.chipTextOn]}>All</Text>
        </Pressable>
        {REGIONS.map((r) => (
          <Pressable
            key={r}
            style={[styles.chip, region === r && styles.chipOn]}
            onPress={() => setRegion(r)}
          >
            <Text style={[styles.chipText, region === r && styles.chipTextOn]}>{r}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.searchBtn} onPress={onExplore} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#0A0A0F" />
        ) : (
          <Text style={styles.searchBtnText}>Explore destinations</Text>
        )}
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {rows.length > 0 ? (
        <View style={styles.modeRow}>
          <Text style={styles.resultsCount}>{rows.length} destinations</Text>
          <View style={styles.modeToggle}>
            <Pressable
              style={[styles.modeBtn, mode === 'list' && styles.modeBtnOn]}
              onPress={() => setMode('list')}
            >
              <Text style={[styles.modeText, mode === 'list' && styles.modeTextOn]}>List</Text>
            </Pressable>
            <Pressable
              style={[styles.modeBtn, mode === 'bubbles' && styles.modeBtnOn]}
              onPress={() => setMode('bubbles')}
            >
              <Text style={[styles.modeText, mode === 'bubbles' && styles.modeTextOn]}>
                Bubbles
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {mode === 'list'
        ? rows.map((d) => (
            <View key={d.destination.code} style={styles.destCard}>
              <View style={styles.destLeft}>
                <Text style={styles.destCity}>{d.destination.city}</Text>
                <Text style={styles.destMeta}>
                  {d.destination.code} · {stopsLabel(d.stops)} · {formatDuration(d.durationMinutes)}
                </Text>
                <DealScoreBadge label={dealLabelFor(d, cheapest, priciest)} />
              </View>
              <Text style={styles.destPrice}>{formatPrice(d.price)}</Text>
            </View>
          ))
        : null}

      {mode === 'bubbles' ? (
        <View style={styles.bubbleWrap}>
          {rows.map((d) => {
            const size = bubbleSize(d.price, cheapest, priciest);
            return (
              <View
                key={d.destination.code}
                style={[
                  styles.bubble,
                  { width: size, height: size, borderRadius: size / 2 },
                ]}
              >
                <Text style={styles.bubbleCode}>{d.destination.code}</Text>
                <Text style={styles.bubblePrice}>{formatPrice(d.price)}</Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </ScrollView>
  );
}

function dealLabelFor(
  d: CheapestDestination,
  cheapest?: number,
  priciest?: number,
): 'great' | 'good' | 'typical' | 'high' {
  if (cheapest == null || priciest == null || priciest === cheapest) return 'typical';
  const t = (d.price - cheapest) / (priciest - cheapest);
  if (t <= 0.25) return 'great';
  if (t <= 0.5) return 'good';
  if (t >= 0.85) return 'high';
  return 'typical';
}

function bubbleSize(price: number, cheapest?: number, priciest?: number): number {
  if (cheapest == null || priciest == null || priciest === cheapest) return 92;
  const t = (price - cheapest) / (priciest - cheapest); // 0 cheap .. 1 pricey
  return Math.round(110 - t * 45); // cheaper = bigger
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  content: { padding: 16, paddingBottom: 48 },
  row: { flexDirection: 'row', marginTop: 14 },
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#12121A',
    borderWidth: 1,
    borderColor: '#1E1E2E',
  },
  chipOn: { backgroundColor: 'rgba(0,255,136,0.15)', borderColor: '#00FF88' },
  chipText: { color: '#8888AA', fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: '#00FF88' },
  searchBtn: {
    backgroundColor: '#00FF88',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  searchBtnText: { color: '#0A0A0F', fontSize: 16, fontWeight: '800' },
  error: { color: '#FF4466', fontSize: 14, marginTop: 14, textAlign: 'center' },
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  resultsCount: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#12121A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E1E2E',
    padding: 2,
  },
  modeBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  modeBtnOn: { backgroundColor: '#1E2744' },
  modeText: { color: '#8888AA', fontSize: 13, fontWeight: '600' },
  modeTextOn: { color: '#00D4FF' },
  destCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#12121A',
    borderWidth: 1,
    borderColor: '#1E1E2E',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  destLeft: { flex: 1, gap: 5 },
  destCity: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  destMeta: { color: '#8888AA', fontSize: 12 },
  destPrice: { color: '#00FF88', fontSize: 20, fontWeight: '800', marginLeft: 12 },
  bubbleWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  bubble: {
    backgroundColor: 'rgba(0,212,255,0.12)',
    borderWidth: 1,
    borderColor: '#00D4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleCode: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  bubblePrice: { color: '#00FF88', fontSize: 13, fontWeight: '700', marginTop: 2 },
});
