# Angstrom

An open-source 40Labs smart lab and home automation assistant platform, beginning with a bedside display on a Raspberry Pi 5 and a 7-inch 1024 × 600 touchscreen.

## Repository structure

```text
Angstrom/
├── apps/display/public/    # Frontend HTML, CSS, JavaScript, and logo assets
├── docs/
│   ├── ARCHITECTURE.md     # Current and planned core/node structure
│   ├── BRAND.md            # 40Labs visual foundation
│   └── RASPBERRY_PI.md     # Display testing and updates
├── scripts/build.py        # Generates dist/ for hosting
├── .openai/hosting.json     # Existing Sites preview identity
├── .gitignore
├── AGENTS.md
└── README.md
```

## Run locally

From the repository root:

```bash
python3 -m http.server 8080 --bind 127.0.0.1 --directory apps/display/public
```

Open http://127.0.0.1:8080 in your browser. No frontend dependencies or build are needed for local development.

## Current functionality

- Live device-local clock and date, defaulting to AM/PM and Fahrenheit.
- Live Open-Meteo weather for Vestal, NY 13850; sunrise/sunset, hourly forecast, highs/lows, feels-like temperature, 15-minute refresh, and stale/cache states.
- Click or tap the weather section for current metrics, daylight duration, the next 12 hours, and a five-day outlook. Return with Back to bedside or Escape.
- Sample calendar layout with day navigation and event details.
- Night-mode visual dimming, fullscreen control, responsive layout, and saved local preferences.

Google Calendar access in the chat is separate from this app. The display does not yet have an authenticated calendar integration. Core services, node agents, multi-room synchronization, voice, automatic boot, and physical backlight control remain planned.

See [architecture](docs/ARCHITECTURE.md), [branding](docs/BRAND.md), and [Pi setup](docs/RASPBERRY_PI.md).

## Build for Sites

```bash
python3 scripts/build.py
```

This copies frontend source into generated `dist/`, matching `.openai/hosting.json`. Run before packaging a Sites deployment. Preserve the existing Site project ID. Building alone does not publish.

## GitHub

Repository: https://github.com/40Labs/Angstrom

The authoring checkout uses `upstream` for 40Labs/Angstrom and `origin` for the johnpforte/Angstrom fork, separate from the Sites publishing workflow. Source changes can be pushed to the fork and proposed to upstream through pull requests. The Raspberry Pi should pull merged updates from the 40Labs repository.

Never commit account tokens, passwords, `.env` files, or private runtime/provider data. GitHub transfers code; the future core will synchronize live application state.

## Testing the weather-details branch

This feature is isolated on `feature/weather-details`; the production Site and `main` are not updated by pushing this branch. See [Pi branch testing](docs/RASPBERRY_PI.md#testing-the-weather-details-branch).

Weather regression checks use Node's built-in test runner (no packages to install):

```bash
node --test tests/weather.test.cjs
```

The tests cover timezone-specific solar times, missing optional values, zero values, stale/offline data, unit preferences, and day rollover. Node is only needed to run these development tests; the Pi frontend still runs through Python and Chromium.
