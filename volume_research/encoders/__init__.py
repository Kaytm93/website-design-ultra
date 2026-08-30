"""IP-10D volume representation encoders.

Three encoders, one per candidate representation:

* ``slices``   — slice-textures encoder, writes a stack of PNG slices.
* ``points``   — sparse-point encoder, writes a glTF binary (.glb) POINTS
                 primitive carrying per-vertex position and density.
* ``packed``   — packed-voxel encoder, writes a single 8-bit-per-voxel
                 binary blob with a documented header.

Each encoder exposes ``encode(declaration, density, output_dir)`` and
returns an :class:`EncoderResult` with the on-disk byte size, the hash, and
the per-encoder GPU-memory bookkeeping.
"""

from .slices import encode_slices, EncoderResult as SlicesResult
from .points import encode_points, EncoderResult as PointsResult
from .packed import encode_packed, EncoderResult as PackedResult

__all__ = [
    "encode_slices",
    "encode_points",
    "encode_packed",
    "SlicesResult",
    "PointsResult",
    "PackedResult",
]