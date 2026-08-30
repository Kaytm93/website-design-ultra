"""Tiny dependency-free PNG decoder for the IP-10D slice-textures decoder.

Supports the subset of PNG 8-bit grayscale that the encoder writes:

* No interlacing.
* Filter type 0 (None) only — that is the filter the encoder always uses
  for byte-stable output.
* 8-bit depth.
* A single IDAT chunk.

Two runs with the same PNG bytes produce byte-identical decoded pixels
because the filter type is fixed and the body is uncompressed zlib.
"""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

import numpy as np

_PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def _read_chunks(payload: bytes):
    """Yield (tag, payload) pairs from a PNG body after the 8-byte signature."""
    cursor = 8
    while cursor < len(payload):
        length = struct.unpack(">I", payload[cursor : cursor + 4])[0]
        cursor += 4
        tag = payload[cursor : cursor + 4]
        cursor += 4
        data = payload[cursor : cursor + length]
        cursor += length
        cursor += 4  # CRC
        yield tag, data


def decode_png_gray(path: Path) -> np.ndarray:
    raw = path.read_bytes()
    if raw[:8] != _PNG_SIGNATURE:
        raise ValueError(f"{path} is not a PNG (signature mismatch)")

    width = height = bit_depth = colour_type = None
    idat_chunks = []

    for tag, data in _read_chunks(raw):
        if tag == b"IHDR":
            width, height, bit_depth, colour_type = struct.unpack(">IIBB", data[:10])
        elif tag == b"IDAT":
            idat_chunks.append(data)
        elif tag == b"IEND":
            break

    if bit_depth != 8:
        raise ValueError(f"{path}: only 8-bit PNGs are supported")
    if colour_type != 0:
        raise ValueError(f"{path}: only grayscale (colour type 0) PNGs are supported")

    compressed = b"".join(idat_chunks)
    decompressed = zlib.decompress(compressed)

    # Each scanline is preceded by a filter byte. We only support filter 0.
    stride = width + 1
    if len(decompressed) != stride * height:
        raise ValueError(
            f"{path}: decompressed length {len(decompressed)} != stride * height = {stride * height}"
        )

    pixels = np.empty((height, width), dtype=np.uint8)
    for y in range(height):
        row_start = y * stride
        if decompressed[row_start] != 0:
            raise ValueError(f"{path}: non-zero filter byte {decompressed[row_start]} at row {y}")
        pixels[y, :] = np.frombuffer(decompressed[row_start + 1 : row_start + stride], dtype=np.uint8)
    return pixels