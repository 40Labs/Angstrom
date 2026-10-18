# Angstrom architecture

The bedside display is one frontend for a future shared Angstrom core. Initially all components will run on the same Pi 5, with clear boundaries so the core can later move to a central server.

## Implemented today

`apps/display/public/` contains the frontend, direct public Open-Meteo weather adapter, browser-local preferences, and cache. Calendar events are samples. No core, node agent, or multi-room synchronization is implemented yet.

## Planned components

- Core: shared API, permissions, conversations, node registry, command handling, and durable settings.
- Integrations: read-only Google Calendar, weather, and Home Assistant device state/actions. Credentials stay server-side.
- Display: present state and submit user requests, retaining only temporary caches and local presentation settings.
- Node agent: stable node ID and room, local microphone/speaker, screen control, and device health.

Add `services/core/`, `agents/node/`, and shared API contracts when implementation begins. A phone can be a frontend without a hardware agent; a microphone node can exist without a display.

## Synchronization contract

The core is authoritative for shared application state; Home Assistant remains authoritative for its devices. Frontends fetch a snapshot over authenticated HTTP and receive versioned updates over a WebSocket. Reconnect by fetching a fresh snapshot. Mark cached data stale/offline.

Commands use unique IDs and confirmed results to prevent duplicate execution. Do not silently queue home-control commands while offline. Brightness, volume, layout, and room assignment are per-node; calendars, permissions, and integration settings are shared.

Voice requests will carry node ID, room, verified speaker, and conversation ID. Coordinate multiple microphones to avoid duplicate interactions. Speaker verification and sensitive-action approval remain unimplemented.

Next steps: implement the core API, move weather behind it, add authenticated read-only Google Calendar, then register the first Pi node and implement synchronization. GitHub distributes code, never live calendar data or private runtime state.
