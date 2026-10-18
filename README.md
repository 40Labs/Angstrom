# Angstrom · Bedside

A dependency-free first display for Angstrom. Designed for a 1024 × 600 bedside touchscreen; also adapts to phones and larger monitors.

## Run locally or on a Raspberry Pi

From this folder, run `python3 -m http.server 8080 --directory dist`, then open `http://localhost:8080` in a browser. No build or package install is required. On the Pi, launch Chromium in kiosk mode pointing at that URL after configuring the operating system and display. A hosted private preview may require sign-in; local serving is the intended basis for an unattended Pi display.

## Working now

- Live device-local clock, date, and timezone; 12/24-hour preferences.
- Live Open-Meteo weather for Vestal, NY 13850, with Fahrenheit/Celsius preferences, automatic 15-minute refresh, manual refresh, timestamps, and cached/offline states.
- Calendar layout with day navigation and event details, using **sample data**.
- Night-mode visual dimming with configurable brightness.
- Fullscreen control where the browser permits it.
- Browser-local saved display preferences, responsive layout, keyboard controls, and native dialogs.

## Integration boundaries

Weather is fetched directly from the public Open-Meteo API using city-center coordinates 42.08507, -76.05381 (verified by Open-Meteo geocoding for Vestal, NY, ZIP 13850). Requests use Eastern time, Fahrenheit internally, Unix timestamps, no account credentials, and no browser geolocation. Weather data is model-derived. The source attribution links to Open-Meteo. Data older than one hour is marked stale; cache older than 24 hours is discarded. Google Calendar is not yet connected to the display. Calendar samples are positioned relative to the current day and do not represent real appointments. The clock uses the browser's local timezone.

Before live integration, replace the sample render sources in `dist/app.js` with a provider layer backed by a shared Angstrom service. Keep account tokens in that service, not in browser source. Include provider timestamps, offline/stale states, and source timezone handling. A voice adapter can later call the same service; no microphone access is requested by this version.

Night mode dims rendered content only; physical backlight/power control requires a Pi node service and hardware capability checks. Automatic boot, kiosk startup, display drivers, and remote node management are deployment steps and are not installed here.

## Files

- `dist/index.html` — accessible display structure and dialogs
- `dist/style.css` — responsive bedside design
- `dist/weather.js` — public weather adapter and cache
- `dist/app.js` — display state, preferences, clock, and sample adapters
- `.openai/hosting.json` — private Sites preview configuration

## GitHub and Raspberry Pi updates

The intended GitHub repository is `https://github.com/40Labs/Angstrom`. The authoring checkout uses a separate remote named `github` so Sites publishing can continue independently. GitHub source publication requires repository access; configuring a remote alone does not upload files.

After the initial source push, clone onto a Pi with GitHub access:

```bash
git clone https://github.com/40Labs/Angstrom.git ~/angstrom
cd ~/angstrom
python3 -m http.server 8080 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:8080` in Chromium on the Pi. Pull subsequent source updates using `git -C ~/angstrom pull --ff-only`, then refresh Chromium. Keep the Pi checkout free of source edits to avoid update conflicts. The authoring checkout pushes updates with `git push github HEAD:main` once the repository's branch has been confirmed.

Do not commit Google tokens, passwords, `.env` files, or runtime data. GitHub distributes code; future live node state and calendar synchronization belong to the Angstrom backend.
