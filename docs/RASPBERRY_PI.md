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
