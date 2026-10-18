"""Generate the static hosting artifact with Python standard-library tools."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'apps' / 'display' / 'public'
DESTINATION = ROOT / 'dist'

if __name__ == '__main__':
    if DESTINATION.exists():
        shutil.rmtree(DESTINATION)
    shutil.copytree(SOURCE, DESTINATION)
    print(f'Built display: {DESTINATION}')
