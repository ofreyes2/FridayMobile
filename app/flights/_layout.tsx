import { Stack } from 'expo-router';

export default function FlightsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0A0A0F' },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: '#0A0A0F' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Flights' }} />
      <Stack.Screen name="search" options={{ title: 'Search Flights' }} />
      <Stack.Screen name="explore" options={{ title: 'Cheapest Anywhere' }} />
      <Stack.Screen name="builder" options={{ title: 'Connection Builder' }} />
      <Stack.Screen name="southwest" options={{ title: 'Southwest Optimizer' }} />
      <Stack.Screen name="alerts" options={{ title: 'Price Alerts' }} />
    </Stack>
  );
}
