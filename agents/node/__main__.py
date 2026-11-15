"""Run from the repository root: python3 -m agents.node --help."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sys

from .audio import AudioError, create_input, list_inputs
from .config import DEFAULT_CONFIG, ROOT, configure, load_config


def main(argv=None):
    parser = argparse.ArgumentParser(description='Angstrom node microphone setup and local capture tests. No background recording or uploads.')
    parser.add_argument('--config', type=Path, default=DEFAULT_CONFIG, help='Local node config (default: config/node.local.json).')
    commands = parser.add_subparsers(dest='command', required=True)
    commands.add_parser('list-inputs', help='List ALSA PCM names without opening a microphone.')
    setup = commands.add_parser('configure', help='Select a microphone; rerun this when replacing hardware.')
    setup.add_argument('--device', required=True, help='Exact PCM name, preferably plughw:CARD=...,DEV=0.')
    setup.add_argument('--node-id', default=None)
    setup.add_argument('--room', default=None)
    commands.add_parser('status', help='Show saved local node configuration without recording.')
    record = commands.add_parser('record', help='Explicitly record a short local WAV test clip.')
    record.add_argument('--seconds', type=int, choices=range(1, 31), default=5, metavar='1..30')
    record.add_argument('--output', type=Path, help='New WAV path. Defaults to an ignored runtime/audio file.')
    args = parser.parse_args(argv)
    try:
        if args.command == 'list-inputs':
            print(list_inputs())
            print('\nSelect the USB microphone PCM listed above. Run arecord -l for physical capture cards. Prefer plughw:CARD=<id>,DEV=<n> over numeric card indexes.')
        elif args.command == 'configure':
            data = configure(args.config, args.device, args.node_id, args.room)
            print(f'Saved {args.config} for {data["node_id"]}: {data["audio"]["device"]}. Hardware has not been opened or tested yet.')
        elif args.command == 'status':
            print(json.dumps(load_config(args.config), indent=2))
        elif args.command == 'record':
            config = load_config(args.config)
            device = config['audio']['device']
            stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
            output = args.output or ROOT / 'runtime' / 'audio' / f'mic-test-{stamp}.wav'
            if output.exists():
                raise AudioError(f'Output already exists: {output}. Use a new filename.')
            source = create_input(config['audio']['backend'], device)
            print(f'Recording {args.seconds}s on {device}. Speak now. Audio stays on this computer.', flush=True)
            clip = source.capture(args.seconds)
            clip.save_wav(output)
            print(f'Saved {output.resolve()} ({clip.seconds:.1f}s, 16000 Hz, mono, PCM16).')
            levels = clip.levels()
            print(json.dumps(levels))
            if levels['rms_dbfs'] is None or levels['rms_dbfs'] < -60:
                print('Signal is silent or very quiet. Check the input, gain, microphone position, and distance.')
            if levels['clipped_percent'] > 0.1:
                print('Clipping detected. Lower input gain or move farther from the microphone.')
            print('Play this file with aplay, or open it in an audio player. Level readings do not verify speech clarity or speaker identity.')
        return 0
    except (AudioError, OSError) as error:
        print(f'Audio setup error: {error}', file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print('\nCapture cancelled.', file=sys.stderr)
        return 130


if __name__ == '__main__':
    raise SystemExit(main())
