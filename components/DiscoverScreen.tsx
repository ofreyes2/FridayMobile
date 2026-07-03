import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

interface Shortcut {
  route: string;
  emoji: string;
  title: string;
  subtitle: string;
  accent: string;
}

const SHORTCUTS: Shortcut[] = [
  {
    route: '/flights/search',
    emoji: '🔎',
    title: 'Search Flights',
    subtitle: 'Anywhere to anywhere, any airline',
    accent: '#00D4FF',
  },
  {
    route: '/flights/explore',
    emoji: '🗺️',
    title: 'Cheapest Anywhere',
    subtitle: 'Discover where you can fly on the cheap',
    accent: '#00FF88',
  },
  {
    route: '/flights/southwest',
    emoji: '🎫',
    title: 'Southwest Optimizer',
    subtitle: 'Tier status & Companion Pass hops',
    accent: '#FFB800',
  },
  {
    route: '/flights/alerts',
    emoji: '🔔',
    title: 'Price Alerts',
    subtitle: 'Get pinged when fares drop',
    accent: '#FF6B9D',
  },
];

export function DiscoverScreen() {
  const router = useRouter();
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Discover</Text>
      <Text style={styles.description}>Flight discovery & real-time price alerts</Text>

      <Pressable style={styles.hero} onPress={() => router.push('/flights' as never)}>
        <Text style={styles.heroEmoji}>✈️</Text>
        <View style={styles.heroBody}>
          <Text style={styles.heroTitle}>Flights</Text>
          <Text style={styles.heroSub}>Live-style fares, cheapest-anywhere & alerts</Text>
        </View>
        <Text style={styles.heroArrow}>›</Text>
      </Pressable>

      <View style={styles.grid}>
        {SHORTCUTS.map((s) => (
          <Pressable
            key={s.route}
            style={styles.tile}
            onPress={() => router.push(s.route as never)}
          >
            <View style={[styles.tileIcon, { backgroundColor: `${s.accent}22` }]}>
              <Text style={styles.tileEmoji}>{s.emoji}</Text>
            </View>
            <Text style={styles.tileTitle}>{s.title}</Text>
            <Text style={styles.tileSub}>{s.subtitle}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginTop: 8 },
  description: { fontSize: 14, color: '#8888AA', marginTop: 4, marginBottom: 20 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12121A',
    borderWidth: 1,
    borderColor: '#00D4FF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
  },
  heroEmoji: { fontSize: 34 },
  heroBody: { flex: 1, marginLeft: 14 },
  heroTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  heroSub: { color: '#8888AA', fontSize: 13, marginTop: 3 },
  heroArrow: { color: '#00D4FF', fontSize: 30, fontWeight: '300' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: {
    width: '48%',
    backgroundColor: '#12121A',
    borderWidth: 1,
    borderColor: '#1E1E2E',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  tileEmoji: { fontSize: 22 },
  tileTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  tileSub: { color: '#8888AA', fontSize: 12, marginTop: 3, lineHeight: 16 },
});
