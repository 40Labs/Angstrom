"""Per-node local configuration. Device choices are not shared account state."""
import json
import os
from pathlib import Path
import re
import tempfile

from .audio import AudioError

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG = ROOT / 'config' / 'node.local.json'


def load_config(path):
    try:
        data = json.loads(Path(path).read_text())
    except FileNotFoundError as error:
        raise AudioError('No local node config. Run configure --device with an input from list-inputs.') from error
    except (json.JSONDecodeError, UnicodeError) as error:
        raise AudioError(f'Invalid JSON config: {path}') from error
    if not isinstance(data, dict) or data.get('version') != 1:
        raise AudioError('Node config must be an object with version 1.')
    if not isinstance(data.get('node_id'), str) or not re.fullmatch(r'[a-z0-9][a-z0-9_-]{0,63}', data['node_id']):
        raise AudioError('node_id must be 1–64 lowercase letters, digits, underscores, or hyphens.')
    if not isinstance(data.get('room'), str) or not data['room'].strip() or len(data['room']) > 80:
        raise AudioError('room must be a nonempty name up to 80 characters.')
    audio = data.get('audio')
    if not isinstance(audio, dict) or audio.get('backend') != 'alsa':
        raise AudioError('audio.backend must be alsa for this version.')
    device = audio.get('device')
    if not isinstance(device, str) or not device.strip() or len(device) > 256 or any(c in device for c in '\r\n\x00'):
        raise AudioError('audio.device must be a PCM name from list-inputs.')
    return data


def configure(path, device, node_id=None, room=None):
    path = Path(path)
    data = load_config(path) if path.exists() else {'version': 1, 'node_id': 'bedroom-01', 'room': 'bedroom', 'audio': {'backend': 'alsa'}}
    data['audio']['device'] = device
    if node_id is not None:
        data['node_id'] = node_id
    if room is not None:
        data['room'] = room
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix='.node-', suffix='.tmp', dir=path.parent)
    try:
        with os.fdopen(fd, 'w') as output:
            json.dump(data, output, indent=2)
            output.write('\n')
        load_config(temporary)
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)
    return data
