# Angstrom · Bedside

A dependency-free first display for Angstrom. Designed for a 1024 × 600 bedside touchscreen; also adapts to phones and larger monitors.

## Run locally or on a Raspberry Pi

From this folder, run `python3 -m http.server 8080 --directory dist`, then open `http://localhost:8080` in a browser. No build or package install is required. On the Pi, launch Chromium in kiosk mode pointing at that URL after configuring the operating system and display. A hosted private preview may require sign-in; local serving is the intended basis for an unattended Pi display.

## Working now

- Live device-local clock, date, and timezone; 12/24-hour preferences.
- Weather layout with Fahrenheit/Celsius preferences, using **sample data**.
- Calendar layout with day navigation and event details, using **sample data**.
- Night-mode visual dimming with configurable brightness.
- Fullscreen control where the browser permits it.
- Browser-local saved display preferences, responsive layout, keyboard controls, and native dialogs.

## Integration boundaries

Weather and calendar are not connected to providers. Weather values and hourly labels are fixed demonstration data, not a live forecast. Calendar samples are positioned relative to the current day and do not represent real appointments. The clock uses the browser's local timezone.

Before live integration, replace the sample render sources in `dist/app.js` with a provider layer backed by a shared Angstrom service. Keep account tokens in that service, not in browser source. Include provider timestamps, offline/stale states, and source timezone handling. A voice adapter can later call the same service; no microphone access is requested by this version.

Night mode dims rendered content only; physical backlight/power control requires a Pi node service and hardware capability checks. Automatic boot, kiosk startup, display drivers, and remote node management are deployment steps and are not installed here.

## Files

- `dist/index.html` — accessible display structure and dialogs
- `dist/style.css` — responsive bedside design
- `dist/app.js` — display state, preferences, clock, and sample adapters
- `.openai/hosting.json` — private Sites preview configuration

The source can be placed in a GitHub repository later. This project does not yet configure a GitHub remote.
