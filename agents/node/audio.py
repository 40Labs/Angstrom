"""Microphone adapters and a hardware-independent audio contract.

Capture is opt-in and bounded. Nothing in this module uploads audio.
"""
from array import array
from dataclasses import dataclass
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
from typing import Protocol
import wave

SAMPLE_RATE = 16000
CHANNELS = 1
SAMPLE_WIDTH = 2


class AudioError(RuntimeError):
    """Actionable capture/device failure."""


@dataclass(frozen=True)
class AudioClip:
    """Signed little-endian PCM16, 16 kHz, mono, regardless of microphone."""
    pcm: bytes

    def __post_init__(self):
        if not self.pcm or len(self.pcm) % SAMPLE_WIDTH:
            raise AudioError('Capture returned empty or misaligned PCM audio.')

    @property
    def seconds(self):
        return len(self.pcm) / (SAMPLE_RATE * CHANNELS * SAMPLE_WIDTH)

    def levels(self):
        samples = array('h')
        samples.frombytes(self.pcm)
        if sys.byteorder != 'little':
            samples.byteswap()
        peak = max(abs(value) for value in samples) / 32768
        rms = math.sqrt(sum(value * value for value in samples) / len(samples)) / 32768
        return {'peak_dbfs': 20 * math.log10(peak) if peak else None,
                'rms_dbfs': 20 * math.log10(rms) if rms else None,
                'clipped_percent': 100 * sum(abs(value) >= 32767 for value in samples) / len(samples)}

    def save_wav(self, path):
        """Create a private WAV file; never replace an existing recording."""
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        try:
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        except FileExistsError as error:
            raise AudioError(f'Recording already exists: {path}. Choose a new output path.') from error
        try:
            with os.fdopen(fd, 'wb') as output:
                with wave.open(output, 'wb') as wav:
                    wav.setnchannels(CHANNELS)
                    wav.setsampwidth(SAMPLE_WIDTH)
                    wav.setframerate(SAMPLE_RATE)
                    wav.writeframes(self.pcm)
        except BaseException:
            path.unlink(missing_ok=True)
            raise
        return path


class AudioInput(Protocol):
    """Future backends must return normalized AudioClip objects."""
    def capture(self, seconds: int) -> AudioClip:
        ...


def require_arecord():
    executable = shutil.which('arecord')
    if executable is None:
        raise AudioError('ALSA capture needs arecord on the Pi. Install it with: sudo apt install alsa-utils. This backend does not capture on macOS.')
    return executable


def list_inputs():
    """Return ALSA PCM names and descriptions without opening a microphone."""
    try:
        result = subprocess.run([require_arecord(), '--list-pcms'], capture_output=True,
                                text=True, timeout=5, check=False)
    except subprocess.TimeoutExpired as error:
        raise AudioError('Listing inputs timed out. Check the USB connection and run arecord -l.') from error
    if result.returncode:
        raise AudioError(f'Cannot list capture devices: {result.stderr.strip()}')
    return result.stdout.strip()


@dataclass
class AlsaInput:
    device: str

    def capture(self, seconds):
        if type(seconds) is not int or not 1 <= seconds <= 30:
            raise AudioError('Recording duration must be a whole number between 1 and 30 seconds.')
        if not isinstance(self.device, str) or not self.device.strip() or len(self.device) > 256 or any(c in self.device for c in '\r\n\x00'):
            raise AudioError('Select a microphone with configure --device before recording.')
        # plughw is recommended: ALSA converts the device's native format.
        # Pass values as an argument array, never through a shell.
        command = [require_arecord(), '--quiet', '--nonblock', f'--device={self.device}',
                   '--file-type=raw', '--format=S16_LE', f'--rate={SAMPLE_RATE}',
                   f'--channels={CHANNELS}', f'--samples={seconds * SAMPLE_RATE}']
        try:
            result = subprocess.run(command, capture_output=True, timeout=seconds + 8, check=False)
        except subprocess.TimeoutExpired as error:
            raise AudioError('Capture timed out; the recorder was stopped. Check that the microphone is connected and not busy.') from error
        diagnostic = result.stderr.decode('utf-8', errors='replace').strip()
        if result.returncode:
            raise AudioError(f'Capture failed for {self.device}: {diagnostic or "ALSA returned no diagnostic"}. Run list-inputs and check the selected device.')
        if 'rate is not accurate' in diagnostic.lower() or 'overrun' in diagnostic.lower():
            raise AudioError(f'Capture format/timing problem: {diagnostic}. Select a plughw PCM and retry.')
        expected = seconds * SAMPLE_RATE * CHANNELS * SAMPLE_WIDTH
        if len(result.stdout) != expected:
            raise AudioError(f'Incomplete recording: expected {expected} PCM bytes, got {len(result.stdout)}. Check for an unplugged or unsupported input.')
        return AudioClip(result.stdout)


def create_input(backend, device) -> AudioInput:
    if backend != 'alsa':
        raise AudioError(f'Unsupported audio backend: {backend}. Available backend: alsa.')
    return AlsaInput(device)
