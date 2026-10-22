"""Prepare new photo copies; never overwrite the original input files."""
import argparse
from pathlib import Path
from PIL import Image, ImageOps


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path)
    args = parser.parse_args()
    source = args.source.resolve()
    destination = args.destination.resolve()
    if not source.is_dir():
        parser.error('Source must be a directory')
    if source == destination or destination.is_relative_to(source):
        parser.error('Choose a destination outside the originals directory')
    photos = sorted(p for p in source.rglob('*') if p.suffix.lower() in ('.jpg', '.jpeg', '.png'))
    targets = [destination / photo.relative_to(source).with_suffix('.webp') for photo in photos]
    if len(set(targets)) != len(targets) or any(target.exists() for target in targets):
        parser.error('An output filename already exists or would collide; choose a fresh destination')
    for photo, target in zip(photos, targets):
        with Image.open(photo) as image:
            image = ImageOps.exif_transpose(image)
            image.thumbnail((1800, 1800), Image.Resampling.LANCZOS)
            if image.mode not in ('RGB', 'RGBA'):
                image = image.convert('RGB')
            target.parent.mkdir(parents=True, exist_ok=True)
            image.save(target, format='WEBP', quality=85, method=6)
            print(f'{target}: width="{image.width}" height="{image.height}"')


if __name__ == '__main__':
    main()
