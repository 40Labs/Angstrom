# Bedroom microphone setup

This branch adds local audio capture tooling for the first Pi node. It is not a complete voice assistant: no wake word, transcription, speaker verification, command execution, background service, or frontend microphone control is implemented.

## Hardware

Start with one of the mini USB microphones from the two-pack connected to the Pi. Keep the second as a spare or for another node. Two separate USB microphones do not automatically form a synchronized array. Class-compliant USB audio devices generally use Linux's existing USB audio driver, but verify this actual device on the Pi rather than relying on the product listing.

Use a short USB extension if necessary to position the microphone near you and away from the Pi fan, case, and speaker. Test normal speech at your actual bedside distance. Far-field pickup, echo cancellation, and the listing's noise-filtering claims are not verified. Speaker playback is a separate output device (for example the monitor's HDMI audio); these microphones only capture input.

## Install and identify the input

On Raspberry Pi OS, from the repository root:

```bash
sudo apt update
sudo apt install alsa-utils
arecord -l
python3 -m agents.node list-inputs
```

`arecord -l` lists physical capture devices; `list-inputs` uses `arecord -L` to list PCM names and descriptions without recording. Find the entry matching the USB microphone. Prefer a named plug device such as `plughw:CARD=Device,DEV=0` instead of a numeric card index. This is an example, not a guaranteed name for this product. If only a named `hw:CARD=Device,DEV=0` is listed, use the same card/device identifiers with `plughw:` for ALSA format conversion.

Do not choose HDMI playback entries. If no input appears, check the connection and `lsusb`; retry with one mic and another USB port. Do not run the recorder with sudo as a workaround for permission problems.

## Save this node's microphone choice

Replace the example PCM name below with the name from your Pi:

```bash
python3 -m agents.node configure --device 'plughw:CARD=Device,DEV=0' --node-id bedroom-01 --room bedroom
python3 -m agents.node status
```

This creates ignored `config/node.local.json`. It is saved with owner-only permissions, contains a local room/node label and audio selector, and is not a registered/authenticated identity on a core yet. The tracked `config/node.example.json` documents its shape.

## Record and listen

```bash
python3 -m agents.node record --seconds 5 --output runtime/audio/bedroom-test.wav
aplay runtime/audio/bedroom-test.wav
```

Speak normally during the five-second capture. The command does not upload audio or start a background listener. It saves a private WAV under ignored runtime storage and reports peak/RMS levels and clipping. Output files are never overwritten: use a new filename for each test, or omit `--output` to generate a timestamped name.

Silence is reported without claiming success at understanding speech. A clear recording of your normal speech is the practical check. The selected playback device must be working separately; use `aplay -l` to inspect outputs or choose `aplay -D <output-PCM> <file.wav>` if needed.

If capture is busy, close other recording applications or select the input managed by your OS audio stack. Named direct hardware access can be held by PipeWire or another service; do not disable the desktop audio stack blindly. If the device disappears or becomes busy, this version fails visibly; rerun capture after fixing the device. It does not auto-switch microphones or silently retry recordings.

To check native capabilities, substitute your real raw device ID:

```bash
arecord -D 'hw:CARD=Device,DEV=0' --dump-hw-params -d 1 -t raw /dev/null
```

This diagnostic briefly opens the microphone. Unsupported default format errors are possible; the capability dump is the useful output. Normal Angstrom capture should use `plughw:` so ALSA can convert native rate/channel/format to the assistant contract.

## Replacing microphones

Run `list-inputs`, identify the new input, and rerun `configure --device '<new PCM>'`. Node/room labels are preserved. You do not change the frontend or future assistant logic.

Named card IDs are more stable than numeric indexes, but two identical USB devices without serial numbers can still have ambiguous or reordered IDs. Start with one per node. Stable USB-port/udev or audio-server aliases can be added if a future multi-input configuration needs them.

## Software boundary

```text
USB microphone → Linux/ALSA → AlsaInput → AudioClip
                                          ↓
                            future wake word / speech pipeline
```

`agents/node/audio.py` defines the `AudioInput` protocol and a normalized `AudioClip`: 16 kHz, mono, signed 16-bit little-endian PCM. The ALSA adapter uses `arecord` with a bounded sample count and no shell. It rejects incomplete capture, timing/rate warnings, and device errors; it does not label failed audio as a valid clip. A future PipeWire, network, I²S, or different-OS adapter must produce that same contract. Hardware requiring a vendor driver still needs its own OS setup.

The initial capture API handles explicit 1–30 second clips. Continuous framed streaming, wake-word detection, cancellation between speech stages, echo handling, and reconnect supervision are subsequent work; this is not a low-latency continuous audio service yet. There is no cloud API key or AI dependency for these capture tests.

Next steps after confirming microphone quality: push-to-talk transcription, spoken replies, then wake word and owner verification. Until verification and authorization are implemented, audio must not be connected to privileged home/infrastructure actions.

## Tests

```bash
python3 -m unittest discover -s tests -p 'test_node_audio.py' -v
```

These tests use simulated ALSA responses and temporary files. They validate the software contract and error handling, not the physical USB microphone, range, acoustic quality, or Pi-specific device support.

## References

- ALSA arecord/aplay options: https://manpages.debian.org/unstable/alsa-utils/arecord.1.en.html
- ALSA PCM configuration: https://www.alsa-project.org/wiki/Asoundrc
