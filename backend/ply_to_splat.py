# Input: PLY file from ml-sharp
# Output: .splat file for GaussianSplats3D
# Pos: Converts PLY format to splat binary format for better compatibility

import struct
import numpy as np
from pathlib import Path
import sys

def ply_to_splat(ply_path: Path, splat_path: Path):
    """Convert PLY to .splat format"""

    with open(ply_path, 'rb') as f:
        # Read header
        header_lines = []
        while True:
            line = f.readline().decode('ascii').strip()
            header_lines.append(line)
            if line == 'end_header':
                break

        # Parse vertex count
        vertex_count = 0
        for line in header_lines:
            if line.startswith('element vertex'):
                vertex_count = int(line.split()[2])
                break

        print(f"Converting {vertex_count} vertices to .splat format")

        # Read binary data (14 floats per vertex in ml-sharp PLY)
        # x, y, z, f_dc_0-2, opacity, scale_0-2, rot_0-3 = 14 floats
        vertex_size = 14 * 4  # 56 bytes
        vertex_data = f.read(vertex_size * vertex_count)

    # Check if we have enough data
    expected_size = vertex_size * vertex_count
    actual_size = len(vertex_data)

    if actual_size < expected_size:
        print(f"Warning: Expected {expected_size} bytes, got {actual_size} bytes")
        print(f"Some vertices may be missing")
        # Adjust vertex count to actual data available
        vertex_count = actual_size // vertex_size
        print(f"Adjusting vertex count to {vertex_count}")

    # Parse vertices
    vertices = []
    for i in range(vertex_count):
        offset = i * vertex_size
        try:
            values = struct.unpack('14f', vertex_data[offset:offset + vertex_size])
            vertices.append(values)
        except struct.error as e:
            print(f"Error at vertex {i}, offset {offset}: {e}")
            print(f"Remaining bytes: {len(vertex_data) - offset}")
            break

    # Convert to .splat format
    # .splat format: position (3 floats), scale (3 floats), color (4 bytes), rotation (4 bytes)
    with open(splat_path, 'wb') as f:
        for vertex in vertices:
            # 14 values: x, y, z, f_dc_0-2, opacity, scale_0-2, rot_0-3
            x, y, z, f_dc_0, f_dc_1, f_dc_2, opacity, scale_0, scale_1, scale_2, rot_0, rot_1, rot_2, rot_3 = vertex

            # Position
            f.write(struct.pack('fff', x, y, z))

            # Scale (exp to convert from log space)
            f.write(struct.pack('fff',
                np.exp(scale_0),
                np.exp(scale_1),
                np.exp(scale_2)
            ))

            # Color (convert f_dc to RGB, 0-255)
            # f_dc values are in spherical harmonics, need to convert
            # For DC component: RGB = 0.5 + SH_C0 * f_dc
            SH_C0 = 0.28209479177387814
            r = int(np.clip((0.5 + SH_C0 * f_dc_0) * 255, 0, 255))
            g = int(np.clip((0.5 + SH_C0 * f_dc_1) * 255, 0, 255))
            b = int(np.clip((0.5 + SH_C0 * f_dc_2) * 255, 0, 255))
            a = int(np.clip(1 / (1 + np.exp(-opacity)) * 255, 0, 255))  # sigmoid

            f.write(struct.pack('BBBB', r, g, b, a))

            # Rotation (normalized quaternion as 4 bytes)
            # Normalize quaternion
            quat = np.array([rot_0, rot_1, rot_2, rot_3])
            quat = quat / (np.linalg.norm(quat) + 1e-8)

            # Convert to uint8 (0-255 maps to -1 to 1)
            rot_bytes = (np.clip(quat, -1, 1) * 127.5 + 127.5).astype(np.uint8)
            f.write(bytes(rot_bytes))

    print(f"Converted to {splat_path}")
    print(f"Output size: {splat_path.stat().st_size / 1024 / 1024:.2f} MB")

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: python ply_to_splat.py <input.ply> <output.splat>")
        sys.exit(1)

    ply_path = Path(sys.argv[1])
    splat_path = Path(sys.argv[2])

    ply_to_splat(ply_path, splat_path)
