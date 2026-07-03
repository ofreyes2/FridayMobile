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
import { useRouter } from 'expo-router';
import { AirportPicker } from '@/components/flights/AirportPicker';
import { FlightResultCard } from '@/components/flights/FlightResultCard';
import {
  searchFlights,
  type CabinClass,
  type FlightResult,
  type SearchMeta,
  type StopFilter,
} from '@/services/flights';

const CABINS: { key: CabinClass; label: string }[] = [
  { key: 'economy', label: 'Economy' },
  { key: 'premium_economy', label: 'Premium' },
  { key: 'business', label: 'Business' },
  { key: 'first', label: 'First' },
];

const STOPS: { key: StopFilter; label: string }[] = [
  { key: 'any', label: 'Any' },
  { key: 'nonstop', label: 'Nonstop' },
  { key: 'one_stop', label: '1 stop' },
  { key: 'multi_stop', label: '2+ stops' },
];

function todayPlus(days: number): string {
  const d = new Date(Date.now() + days * 86400000);
  return d.toISOString().slice(0, 10);
}

export default function SearchScreen() {
  const router = useRouter();
  const [origin, setOrigin] = useState('ORD');
  const [destination, setDestination] = useState('LAX');
  const [departDate, setDepartDate] = useState(todayPlus(21));
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [cabin, setCabin] = useState<CabinClass>('economy');
  const [stops, setStops] = useState<StopFilter>('any');
  const [maxPrice, setMaxPrice] = useState('');
  const [southwestOnly, setSouthwestOnly] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<FlightResult[]>([]);
  const [meta, setMeta] = useState<SearchMeta | null>(null);

  const passengers = adults + children;

  const onSearch = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await searchFlights({
        origins: origin ? [origin] : [],
        destinations: destination ? [destination] : [],
        departDate,
        passengers: { adults, children },
        filters: {
          cabin,
          stops,
          maxPrice: maxPrice ? Number(maxPrice) : undefined,
          southwestOnly,
        },
      });
      setResults(res.results);
      setMeta(res.meta);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const tagFor = (r: FlightResult): string | undefined => {
    if (!meta) return undefined;
    if (r.itineraryId === meta.cheapest) return 'Cheapest';
    if (r.itineraryId === meta.fastest) return 'Fastest';
    if (r.itineraryId === meta.bestValue) return 'Best value';
    return undefined;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.row}>
        <AirportPicker label="From" value={origin} onChange={setOrigin} allowAnywhere />
        <View style={styles.gap} />
        <AirportPicker label="To" value={destination} onChange={setDestination} allowAnywhere />
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.label}>Depart date</Text>
        <TextInput
          style={styles.input}
          value={departDate}
          onChangeText={setDepartDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#5A5A7A"
        />
      </View>

      <View style={styles.row}>
        <Stepper label="Adults" value={adults} min={1} onChange={setAdults} />
        <View style={styles.gap} />
        <Stepper label="Children" value={children} min={0} onChange={setChildren} />
      </View>

      <Text style={styles.label}>Cabin</Text>
      <Chips
        options={CABINS}
        value={cabin}
        onChange={(v) => setCabin(v as CabinClass)}
      />

      <Text style={styles.label}>Stops</Text>
      <Chips options={STOPS} value={stops} onChange={(v) => setStops(v as StopFilter)} />

      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.label}>Max price / traveler</Text>
          <TextInput
            style={styles.input}
            value={maxPrice}
            onChangeText={setMaxPrice}
            keyboardType="numeric"
            placeholder="No limit"
            placeholderTextColor="#5A5A7A"
          />
        </View>
        <View style={styles.gap} />
        <View style={styles.flex}>
          <Text style={styles.label}>Southwest only</Text>
          <Pressable
            style={[styles.toggle, southwestOnly && styles.toggleOn]}
            onPress={() => setSouthwestOnly((v) => !v)}
          >
            <Text style={[styles.toggleText, southwestOnly && styles.toggleTextOn]}>
              {southwestOnly ? 'On' : 'Off'}
            </Text>
          </Pressable>
        </View>
      </View>

      <Pressable style={styles.searchBtn} onPress={onSearch} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#0A0A0F" />
        ) : (
          <Text style={styles.searchBtnText}>Search flights</Text>
        )}
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {meta ? (
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>
            {meta.count} {meta.count === 1 ? 'result' : 'results'}
          </Text>
          <Pressable onPress={() => router.push('/flights/alerts' as never)}>
            <Text style={styles.createAlert}>+ Alert for this route</Text>
          </Pressable>
        </View>
      ) : null}

      {results.map((r) => (
        <FlightResultCard key={r.itineraryId} result={r} passengers={passengers} tag={tagFor(r)} />
      ))}

      {meta && results.length === 0 ? (
        <Text style={styles.empty}>No flights matched your filters. Try widening them.</Text>
      ) : null}
    </ScrollView>
  );
}

function Stepper({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.flex}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable
          style={styles.stepBtn}
          onPress={() => onChange(Math.max(min, value - 1))}
        >
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <Text style={styles.stepValue}>{value}</Text>
        <Pressable style={styles.stepBtn} onPress={() => onChange(value + 1)}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((o) => (
        <Pressable
          key={o.key}
          style={[styles.chip, value === o.key && styles.chipOn]}
          onPress={() => onChange(o.key)}
        >
          <Text style={[styles.chipText, value === o.key && styles.chipTextOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  content: { padding: 16, paddingBottom: 48 },
  row: { flexDirection: 'row', marginBottom: 14 },
  gap: { width: 12 },
  flex: { flex: 1 },
  fieldBlock: { marginBottom: 14 },
  label: { color: '#8888AA', fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 4 },
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
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#12121A',
    borderWidth: 1,
    borderColor: '#1E1E2E',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#1E2744',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: '#00D4FF', fontSize: 20, fontWeight: '700' },
  stepValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#12121A',
    borderWidth: 1,
    borderColor: '#1E1E2E',
  },
  chipOn: { backgroundColor: 'rgba(0,212,255,0.15)', borderColor: '#00D4FF' },
  chipText: { color: '#8888AA', fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: '#00D4FF' },
  toggle: {
    backgroundColor: '#12121A',
    borderWidth: 1,
    borderColor: '#1E1E2E',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  toggleOn: { backgroundColor: 'rgba(255,184,0,0.15)', borderColor: '#FFB800' },
  toggleText: { color: '#8888AA', fontSize: 15, fontWeight: '700' },
  toggleTextOn: { color: '#FFB800' },
  searchBtn: {
    backgroundColor: '#00D4FF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  searchBtnText: { color: '#0A0A0F', fontSize: 16, fontWeight: '800' },
  error: { color: '#FF4466', fontSize: 14, marginTop: 14, textAlign: 'center' },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  resultsCount: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  createAlert: { color: '#00D4FF', fontSize: 13, fontWeight: '600' },
  empty: { color: '#5A5A7A', fontSize: 14, textAlign: 'center', marginTop: 24 },
});
