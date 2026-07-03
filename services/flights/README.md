# Flights module

Flight discovery & alerts feature for FridayMobile. Everything is TypeScript and
lives behind `@/services/flights`.

## What's here

| File | Responsibility |
| --- | --- |
| `types.ts` | Domain types (Airport, FlightResult, Alert, …) |
| `airports.ts` | Airport dataset + geo/distance/metro helpers |
| `provider.ts` | `FlightProvider` interface + deterministic `MockFlightProvider` |
| `flightService.ts` | Search, cheapest-anywhere, connection builder, Southwest optimizer, TTL cache |
| `alertsService.ts` | Supabase CRUD for alerts, price history, preferences + `evaluateAlert` worker logic |
| `index.ts` | Public barrel + formatting helpers |
| `schema.sql` | Postgres tables + RLS for alerts / price history / preferences / notifications |

## UI

- Route group: `app/flights/*` (hub, search, explore, builder, southwest, alerts)
- Components: `components/flights/*` (FlightResultCard, AirportPicker, DealScoreBadge, PriceTrendChart)
- Entry point: the **Discover** tab (`components/DiscoverScreen.tsx`)

## Swapping in a real flight API

The app only depends on the `FlightProvider` interface, never on a concrete
API. To integrate a real GDS / OTA / meta-search provider (Amadeus, Duffel,
Kiwi/Tequila, Skyscanner):

```ts
import { setFlightProvider, type FlightProvider } from '@/services/flights';

class AmadeusProvider implements FlightProvider {
  readonly name = 'amadeus';
  async searchLeg(q) {
    // call the real API, map its response into FlightResult[]
  }
}

setFlightProvider(new AmadeusProvider()); // e.g. in app/_layout.tsx bootstrap
```

The mock is deterministic (prices seeded from route + date) so price history and
alerts behave sensibly during development.

## Database

Run `services/flights/schema.sql` in the Supabase SQL editor. It's idempotent
and adds row-level security so users only see their own alerts, preferences and
notifications.

## Background alert worker

`evaluateAlert(alert)` contains the polling logic (find cheapest matching fare,
record a price-history point, decide whether to trigger). Wire it into a
Supabase Edge Function on a cron schedule for server-side alerts, or call
`evaluateActiveAlerts(userId)` from the app for an on-demand "Check now".
Triggers fire when the current price is at/below the threshold or a new low
appears.
