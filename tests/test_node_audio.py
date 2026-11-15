"""Hardware-free tests: no real microphone is opened."""
import io
import json
from pathlib import Path
import struct
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import wave

from agents.node.audio import AlsaInput, AudioClip, AudioError, create_input, list_inputs
from agents.node.config import configure, load_config
from agents.node.__main__ import main


class AudioTests(unittest.TestCase):
    @patch('agents.node.audio.shutil.which', return_value='/usr/bin/arecord')
    @patch('agents.node.audio.subprocess.run')
    def test_capture_contract_and_literal_device(self, run, which):
        device = 'plughw:CARD=USB,DEV=0'
        run.return_value = subprocess.CompletedProcess([], 0, bytes(32000), b'')
        clip = AlsaInput(device).capture(1)
        self.assertEqual(clip.seconds, 1)
        arguments, options = run.call_args
        self.assertIn('--format=S16_LE', arguments[0])
        self.assertIn('--samples=16000', arguments[0])
        self.assertIn('--rate=16000', arguments[0])
        self.assertIn('--channels=1', arguments[0])
        self.assertIn('--device=' + device, arguments[0])
        self.assertNotIn('shell', options)
        self.assertEqual(options['timeout'], 9)

    @patch('agents.node.audio.shutil.which', return_value='/usr/bin/arecord')
    @patch('agents.node.audio.subprocess.run')
    def test_partial_capture_is_rejected(self, run, which):
        run.return_value = subprocess.CompletedProcess([], 0, bytes(100), b'')
        with self.assertRaisesRegex(AudioError, 'Incomplete'):
            AlsaInput('default').capture(1)

    @patch('agents.node.audio.shutil.which', return_value='/usr/bin/arecord')
    @patch('agents.node.audio.subprocess.run')
    def test_busy_and_timeout_errors(self, run, which):
        run.return_value = subprocess.CompletedProcess([], 1, b'', b'Device or resource busy')
        with self.assertRaisesRegex(AudioError, 'busy'):
            AlsaInput('default').capture(1)
        run.side_effect = subprocess.TimeoutExpired('arecord', 9)
        with self.assertRaisesRegex(AudioError, 'timed out'):
            AlsaInput('default').capture(1)

    @patch('agents.node.audio.shutil.which', return_value='/usr/bin/arecord')
    @patch('agents.node.audio.subprocess.run')
    def test_inaccurate_rate_and_overrun_are_rejected(self, run, which):
        for warning in [b'Warning: rate is not accurate', b'overrun!!!']:
            run.return_value = subprocess.CompletedProcess([], 0, bytes(32000), warning)
            with self.assertRaisesRegex(AudioError, 'format/timing'):
                AlsaInput('default').capture(1)

    @patch('agents.node.audio.shutil.which', return_value=None)
    def test_missing_dependency(self, which):
        with self.assertRaisesRegex(AudioError, 'alsa-utils'):
            list_inputs()

    @patch('agents.node.audio.subprocess.run')
    def test_invalid_duration_does_not_open_device(self, run):
        for duration in [0, 31, 1.5, True]:
            with self.assertRaises(AudioError):
                AlsaInput('default').capture(duration)
        run.assert_not_called()

    def test_wav_format_permissions_and_no_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'test.wav'
            clip = AudioClip(struct.pack('<hhhh', 0, 1000, -1000, 0))
            clip.save_wav(target)
            self.assertEqual(target.stat().st_mode & 0o777, 0o600)
            with wave.open(str(target)) as wav:
                self.assertEqual((wav.getframerate(), wav.getnchannels(), wav.getsampwidth()), (16000, 1, 2))
                self.assertEqual(wav.readframes(4), clip.pcm)
            original = target.read_bytes()
            with self.assertRaises(AudioError):
                clip.save_wav(target)
            self.assertEqual(target.read_bytes(), original)

    def test_levels_distinguish_silence_and_clipping(self):
        self.assertIsNone(AudioClip(bytes(20)).levels()['rms_dbfs'])
        loud = AudioClip(struct.pack('<hh', 32767, -32768)).levels()
        self.assertEqual(loud['clipped_percent'], 100)
        self.assertAlmostEqual(loud['peak_dbfs'], 0)
        with self.assertRaises(AudioError):
            AudioClip(b'')
        with self.assertRaises(AudioError):
            AudioClip(b'x')

    def test_microphone_replacement_preserves_node_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory) / 'node.local.json'
            configure(config, 'plughw:CARD=USB,DEV=0', 'bedroom-01', 'bedroom')
            configure(config, 'plughw:CARD=NewMic,DEV=0')
            data = load_config(config)
            self.assertEqual(data['node_id'], 'bedroom-01')
            self.assertEqual(data['room'], 'bedroom')
            self.assertEqual(create_input(**data['audio']).device, 'plughw:CARD=NewMic,DEV=0')
            original = config.read_bytes()
            with self.assertRaises(AudioError):
                configure(config, 'new', node_id='../bad')
            self.assertEqual(config.read_bytes(), original)

    def test_corrupt_config_and_unsupported_backend(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'config.json'
            for invalid in ['[]', '{', '{"version": 99}']:
                path.write_text(invalid)
                with self.assertRaises(AudioError):
                    load_config(path)
        with self.assertRaises(AudioError):
            create_input('unknown', 'device')

    @patch('agents.node.__main__.create_input')
    def test_capture_failure_leaves_no_audio_file(self, create):
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory) / 'node.local.json'
            output = Path(directory) / 'clip.wav'
            configure(config, 'default')
            create.return_value.capture.side_effect = AudioError('unplugged')
            with patch('sys.stdout', new_callable=io.StringIO), patch('sys.stderr', new_callable=io.StringIO):
                result = main(['--config', str(config), 'record', '--output', str(output)])
            self.assertEqual(result, 1)
            self.assertFalse(output.exists())

    @patch('agents.node.__main__.create_input')
    def test_existing_output_does_not_start_recording(self, create):
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory) / 'node.local.json'
            output = Path(directory) / 'clip.wav'
            configure(config, 'default')
            output.write_bytes(b'keep')
            with patch('sys.stdout', new_callable=io.StringIO), patch('sys.stderr', new_callable=io.StringIO):
                self.assertEqual(main(['--config', str(config), 'record', '--output', str(output)]), 1)
            create.assert_not_called()
            self.assertEqual(output.read_bytes(), b'keep')


if __name__ == '__main__':
    unittest.main()
