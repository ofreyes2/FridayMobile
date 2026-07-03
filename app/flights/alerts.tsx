import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert as RNAlert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { AirportPicker } from '@/components/flights/AirportPicker';
import { PriceTrendChart } from '@/components/flights/PriceTrendChart';
import {
  createAlert,
  deleteAlert,
  describeAlert,
  evaluateAlert,
  formatPrice,
  getPriceHistory,
  listAlerts,
  routeKey,
  toggleAlert,
  type Alert,
  type AlertKind,
  type NewAlert,
  type PricePoint,
} from '@/services/flights';

function todayPlus(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

const KINDS: { key: AlertKind; label: string }[] = [
  { key: 'route', label: 'Route' },
  { key: 'cheapest_anywhere', label: 'Anywhere' },
  { key: 'southwest', label: 'Southwest' },
];

export default function AlertsScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, PricePoint[]>>({});
  const [notice, setNotice] = useState<string | null>(null);

  // New alert form
  const [kind, setKind] = useState<AlertKind>('route');
  const [origin, setOrigin] = useState('ORD');
  const [destination, setDestination] = useState('LAX');
  const [departDate, setDepartDate] = useState(todayPlus(30));
  const [maxPrice, setMaxPrice] = useState('200');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (uid: string) => {
    setLoading(true);
    try {
      const rows = await listAlerts(uid);
      setAlerts(rows);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id ?? null;
      setUserId(uid);
      if (uid) load(uid);
      else setLoading(false);
    });
  }, [load]);

  const onCreate = async () => {
    if (!userId) {
      setNotice('Sign in to create alerts.');
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const draft: NewAlert = {
        kind,
        label: '',
        origins: origin ? [origin] : [],
        destinations: kind === 'route' && destination ? [destination] : [],
        departDate,
        maxPrice: Number(maxPrice) || 0,
        airlines: [],
        cabin: 'economy',
        southwestOnly: kind === 'southwest',
        isActive: true,
      };
      draft.label = describeAlert(draft);
      const created = await createAlert(userId, draft);
      setAlerts((prev) => [created, ...prev]);
      setNotice('Alert created.');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not create alert');
    } finally {
      setSaving(false);
    }
  };

  const onToggle = async (a: Alert) => {
    try {
      const updated = await toggleAlert(a.id, !a.isActive);
      setAlerts((prev) => prev.map((x) => (x.id === a.id ? updated : x)));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Toggle failed');
    }
  };

  const onDelete = (a: Alert) => {
    RNAlert.alert('Delete alert', `Remove "${a.label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAlert(a.id);
            setAlerts((prev) => prev.filter((x) => x.id !== a.id));
          } catch (e) {
            setNotice(e instanceof Error ? e.message : 'Delete failed');
          }
        },
      },
    ]);
  };

  const onCheckNow = async (a: Alert) => {
    setBusyId(a.id);
    setNotice(null);
    try {
      const evalResult = await evaluateAlert(a);
      setAlerts((prev) =>
        prev.map((x) =>
          x.id === a.id
            ? {
                ...x,
                lastPrice: Math.min(x.lastPrice ?? Infinity, evalResult.currentPrice),
                lastCheckedAt: new Date().toISOString(),
              }
            : x,
        ),
      );
      const key = routeKey(a.origins[0] ?? 'ANY', a.destinations[0] ?? 'ANY', a.departDate);
      const points = await getPriceHistory(key);
      setHistory((prev) => ({ ...prev, [a.id]: points }));
      setNotice(
        evalResult.triggered
          ? `🔔 ${formatPrice(evalResult.currentPrice)} — ${
              evalResult.reason === 'below_threshold' ? 'below your threshold!' : 'new low!'
            }`
          : `Cheapest now ${formatPrice(evalResult.currentPrice)} (above ${formatPrice(a.maxPrice)}).`,
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Check failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Create form */}
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>New price alert</Text>
        <View style={styles.chipRow}>
          {KINDS.map((k) => (
            <Pressable
              key={k.key}
              style={[styles.chip, kind === k.key && styles.chipOn]}
              onPress={() => setKind(k.key)}
            >
              <Text style={[styles.chipText, kind === k.key && styles.chipTextOn]}>{k.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.row}>
          <AirportPicker
            label="From"
            value={origin}
            onChange={setOrigin}
            allowAnywhere={kind !== 'route'}
          />
          {kind === 'route' ? (
            <>
              <View style={styles.gap} />
              <AirportPicker label="To" value={destination} onChange={setDestination} />
            </>
          ) : null}
        </View>

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
            <Text style={styles.label}>Alert below</Text>
            <TextInput
              style={styles.input}
              value={maxPrice}
              onChangeText={setMaxPrice}
              keyboardType="numeric"
              placeholder="200"
              placeholderTextColor="#5A5A7A"
            />
          </View>
        </View>

        <Pressable style={styles.createBtn} onPress={onCreate} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#0A0A0F" />
          ) : (
            <Text style={styles.createBtnText}>Create alert</Text>
          )}
        </Pressable>
      </View>

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      {!userId && !loading ? (
        <Text style={styles.signin}>Sign in to save alerts to your account.</Text>
      ) : null}

      <Text style={styles.sectionTitle}>Your alerts</Text>

      {loading ? (
        <ActivityIndicator color="#00D4FF" style={{ marginTop: 20 }} />
      ) : alerts.length === 0 ? (
        <Text style={styles.empty}>No alerts yet. Create one above.</Text>
      ) : (
        alerts.map((a) => (
          <View key={a.id} style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <View style={styles.flex}>
                <Text style={styles.alertLabel}>{a.label}</Text>
                <Text style={styles.alertMeta}>
                  {a.departDate}
                  {a.lastPrice != null ? ` · seen ${formatPrice(a.lastPrice)}` : ''}
                </Text>
              </View>
              <Switch
                value={a.isActive}
                onValueChange={() => onToggle(a)}
                trackColor={{ false: '#1E1E2E', true: 'rgba(0,212,255,0.5)' }}
                thumbColor={a.isActive ? '#00D4FF' : '#5A5A7A'}
              />
            </View>

            {history[a.id] ? (
              <View style={styles.chartWrap}>
                <PriceTrendChart points={history[a.id]} threshold={a.maxPrice} />
              </View>
            ) : null}

            <View style={styles.alertActions}>
              <Pressable
                style={styles.actionBtn}
                onPress={() => onCheckNow(a)}
                disabled={busyId === a.id}
              >
                {busyId === a.id ? (
                  <ActivityIndicator color="#00D4FF" size="small" />
                ) : (
                  <Text style={styles.actionText}>Check now</Text>
                )}
              </Pressable>
              <Pressable style={styles.actionBtn} onPress={() => onDelete(a)}>
                <Text style={[styles.actionText, { color: '#FF4466' }]}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  content: { padding: 16, paddingBottom: 48 },
  formCard: {
    backgroundColor: '#12121A',
    borderWidth: 1,
    borderColor: '#1E1E2E',
    borderRadius: 14,
    padding: 16,
  },
  formTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', marginBottom: 12 },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#0A0A0F',
    borderWidth: 1,
    borderColor: '#1E1E2E',
  },
  chipOn: { backgroundColor: 'rgba(0,212,255,0.15)', borderColor: '#00D4FF' },
  chipText: { color: '#8888AA', fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: '#00D4FF' },
  row: { flexDirection: 'row', marginBottom: 4 },
  gap: { width: 12 },
  flex: { flex: 1 },
  label: { color: '#8888AA', fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#0A0A0F',
    borderWidth: 1,
    borderColor: '#1E1E2E',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 15,
  },
  createBtn: {
    backgroundColor: '#00D4FF',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 18,
  },
  createBtnText: { color: '#0A0A0F', fontSize: 15, fontWeight: '800' },
  notice: {
    color: '#00D4FF',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 14,
    backgroundColor: 'rgba(0,212,255,0.08)',
    padding: 10,
    borderRadius: 8,
  },
  signin: { color: '#FFB800', fontSize: 13, textAlign: 'center', marginTop: 14 },
  sectionTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginTop: 26, marginBottom: 12 },
  empty: { color: '#5A5A7A', fontSize: 14, textAlign: 'center', marginTop: 12 },
  alertCard: {
    backgroundColor: '#12121A',
    borderWidth: 1,
    borderColor: '#1E1E2E',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  alertHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  alertLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  alertMeta: { color: '#8888AA', fontSize: 12, marginTop: 3 },
  chartWrap: { marginTop: 14 },
  alertActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    borderTopWidth: 1,
    borderColor: '#1E1E2E',
    paddingTop: 12,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#0A0A0F',
    borderWidth: 1,
    borderColor: '#1E1E2E',
  },
  actionText: { color: '#00D4FF', fontSize: 14, fontWeight: '700' },
});
