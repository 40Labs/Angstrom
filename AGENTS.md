# Angstrom project guidance

- Keep source changes in this repository root. Read README.md, docs/ARCHITECTURE.md, and docs/BRAND.md before architecture/visual changes.
- Frontend source is apps/display/public/. Build generated dist/ with `python3 scripts/build.py`; never edit or commit dist/.
- Target a 1024 × 600 landscape bedside screen, retaining phone usability.
- Use original 40Labs assets, carbon backgrounds, amber accents, and restrained circular linework.
- Default to AM/PM and Fahrenheit; no decorative greeting above the clock.
- Calendar events are samples until a real authenticated backend integration works. Do not imply live calendar, voice, or node functionality prematurely.
- Keep credentials, private provider data, and runtime state out of Git and browser assets.
- Preserve the existing .openai/hosting.json Site ID and keep GitHub and Sites remotes independent.
