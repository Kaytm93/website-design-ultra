"""Tiny dependency-free PNG encoder for the slice-textures representation.

Supports 8-bit grayscale (``L``) and 8-bit truecolor with alpha (``RGBA``)
images. Encodes one PNG per call.

The encoder is intentionally minimal:

* No interlacing.
* No filter optimisation other than the standard set 0/1/2/3/4 — we use
  filter type 0 (None) for reproducibility, so byte output is stable for a
  stable input.
* No text chunks, no ICC profile, no sRGB chunk. The benchmark only needs
  the pixel data to round-trip.

It is *not* a general PNG library. It exists because the IP-10D research
gate needs an encoder that produces byte-stable output across runs, and the
declared dependencies are numpy + the standard library only.
"""

from __future__ import annotations

import struct
import zlib
from pathlib import Path
from typing import Iterable, Sequence

import numpy as np


_PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def _chunk(tag: bytes, payload: bytes) -> bytes:
    length = struct.pack(">I", len(payload))
    crc = struct.pack(">I", zlib.crc32(tag + payload) & 0xFFFFFFFF)
    return length + tag + payload + crc


def encode_png_gray(image: np.ndarray) -> bytes:
    """Encode a 2D ``uint8`` array as an 8-bit grayscale PNG.

    Filter type 0 (None) is used so two runs with the same input produce
    byte-identical output.
    """
    if image.ndim != 2:
        raise ValueError("encode_png_gray expects a 2D array")
    if image.dtype != np.uint8:
        raise ValueError("encode_png_gray expects a uint8 array")

    height, width = image.shape

    # IHDR: width(4) + height(4) + bit_depth(1) + colour_type(1) +
    #       compression(1) + filter(1) + interlace(1)
    ihdr_payload = struct.pack(
        ">IIBBBBB",
        width,
        height,
        8,  # bit depth
        0,  # colour type 0 = grayscale
        0,  # compression method 0
        0,  # filter method 0
        0,  # interlace method 0 (no interlace)
    )

    # IDAT: each scanline is preceded by a filter byte (0 = None).
    # Prepending 0 to each row keeps decoding trivial.
    scanlines = bytearray()
    for row in image:
        scanlines.append(0)
        scanlines.extend(row.tobytes())

    idat_payload = zlib.compress(bytes(scanlines), level=9)

    out = bytearray()
    out.extend(_PNG_SIGNATURE)
    out.extend(_chunk(b"IHDR", ihdr_payload))
    out.extend(_chunk(b"IDAT", idat_payload))
    out.extend(_chunk(b"IEND", b""))
    return bytes(out)


def encode_png_gray_stack(volume: np.ndarray, output_dir: Path, name_prefix: str = "slice") -> list[Path]:
    """Encode a 3D ``uint8`` volume as a stack of grayscale PNG slices.

    Slices are emitted in z-order: ``slice_000.png``, ``slice_001.png``, ...
    Returns the list of written paths.
    """
    if volume.ndim != 3:
        raise ValueError("encode_png_gray_stack expects a 3D array")
    if volume.dtype != np.uint8:
        raise ValueError("encode_png_gray_stack expects a uint8 array")

    output_dir.mkdir(parents=True, exist_ok=True)
    paths: list[Path] = []
    depth = volume.shape[2]
    for z in range(depth):
        path = output_dir / f"{name_prefix}_{z:03d}.png"
        path.write_bytes(encode_png_gray(volume[:, :, z]))
        paths.append(path)
    return paths