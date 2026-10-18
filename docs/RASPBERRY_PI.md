# Raspberry Pi 5 display test

Use Raspberry Pi OS Desktop (64-bit), landscape 1024 × 600, and Chromium at 100% zoom. Connect monitor touch USB according to its instructions.

After the first GitHub push, authenticate Git on the Pi for the private repository:

```bash
git clone https://github.com/40Labs/Angstrom.git ~/angstrom
cd ~/angstrom
python3 -m http.server 8080 --bind 127.0.0.1 --directory apps/display/public
```

Leave the server running. Open http://127.0.0.1:8080 on the Pi, or launch from another desktop terminal:

```bash
chromium --kiosk --no-first-run http://127.0.0.1:8080
```

Local serving needs no hosted-preview sign-in or build. Fresh weather requires internet. Calendar entries remain samples. Check fit, touch controls, night mode, AM/PM time, Fahrenheit, and live weather status. Stop the server using Ctrl+C.

## Updates

```bash
git -C ~/angstrom pull --ff-only
```

Refresh Chromium after pulling. Keep Pi runtime configuration and secrets outside tracked source. Automatic startup, service supervision, hardware controls, and the core/node services still need implementation.

## Testing the weather-details branch

From an existing Pi clone (whose `origin` is 40Labs/Angstrom), check that `git status --short` is empty, then run:

```bash
cd ~/angstrom
git fetch origin
git switch --track origin/feature/weather-details
python3 -m http.server 8081 --bind 127.0.0.1 --directory apps/display/public
```

If that local branch already exists, use `git switch feature/weather-details` followed by `git pull --ff-only`. Open `http://127.0.0.1:8081` on the Pi; this port keeps testing separate from a display already serving on 8080. If the original display server is still running from this same checkout, stop it before switching branches, since it also serves the checked-out files.

Check sunrise and sunset on the weather summary. Tap anywhere in that section to open weather details, scroll through the hourly and daily forecasts, then use Back to bedside or Escape. Times follow Eastern time for Vestal; AM/PM and Fahrenheit remain the defaults. The detail view scrolls intentionally; the bedside summary should fit at 1024 × 600 without scrolling.

To return to the stable version, stop the test server with Ctrl+C and run:

```bash
git switch main
```

Refresh or restart the original display server. Switching a Pi checkout's branch does not change GitHub main or the hosted production Site.
