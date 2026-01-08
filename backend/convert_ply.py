# Input: ml-sharp PLY file
# Output: Standard Gaussian Splatting PLY file with RGB colors
# Pos: Converter to add RGB colors from spherical harmonics for compatibility
# If this file is updated, you must update this header and the parent folder's README.md.

import struct
import sys
from pathlib import Path

# Spherical harmonics constant for DC component
SH_C0 = 0.28209479177387814

def sh_to_rgb(f_dc_0: float, f_dc_1: float, f_dc_2: float) -> tuple:
    """Convert spherical harmonics DC coefficients to RGB (0-255)"""
    r = int(max(0, min(255, (0.5 + SH_C0 * f_dc_0) * 255)))
    g = int(max(0, min(255, (0.5 + SH_C0 * f_dc_1) * 255)))
    b = int(max(0, min(255, (0.5 + SH_C0 * f_dc_2) * 255)))
    return r, g, b

def convert_mlsharp_ply(input_path: Path, output_path: Path):
    """Convert ml-sharp PLY to standard Gaussian Splatting PLY format with RGB colors"""

    with open(input_path, 'rb') as f:
        # Read header
        header_lines = []
        while True:
            line = f.readline().decode('ascii').strip()
            header_lines.append(line)
            if line == 'end_header':
                break

        # Parse header to get vertex count
        vertex_count = 0
        for line in header_lines:
            if line.startswith('element vertex'):
                vertex_count = int(line.split()[2])
                break

        print(f"Found {vertex_count} vertices")

        # Read binary vertex data
        # ml-sharp PLY has 14 floats per vertex: x, y, z, f_dc_0-2, opacity, scale_0-2, rot_0-3
        vertex_size = 14 * 4  # 14 floats * 4 bytes = 56 bytes
        vertex_data = f.read(vertex_size * vertex_count)

        print(f"Read {len(vertex_data)} bytes of vertex data ({len(vertex_data) // vertex_size} vertices)")

    # Parse vertices and compute RGB colors
    vertices = []
    for i in range(vertex_count):
        offset = i * vertex_size
        values = struct.unpack('<14f', vertex_data[offset:offset + vertex_size])
        x, y, z = values[0], values[1], values[2]
        f_dc_0, f_dc_1, f_dc_2 = values[3], values[4], values[5]
        opacity = values[6]
        scale_0, scale_1, scale_2 = values[7], values[8], values[9]
        rot_0, rot_1, rot_2, rot_3 = values[10], values[11], values[12], values[13]

        # Convert SH to RGB
        r, g, b = sh_to_rgb(f_dc_0, f_dc_1, f_dc_2)

        vertices.append((x, y, z, r, g, b, f_dc_0, f_dc_1, f_dc_2, opacity,
                        scale_0, scale_1, scale_2, rot_0, rot_1, rot_2, rot_3))

    # Write output file with RGB colors and SH coefficients
    with open(output_path, 'wb') as f:
        # Write header with RGB and SH properties
        f.write(b'ply\n')
        f.write(b'format binary_little_endian 1.0\n')
        f.write(f'element vertex {vertex_count}\n'.encode('ascii'))
        f.write(b'property float x\n')
        f.write(b'property float y\n')
        f.write(b'property float z\n')
        f.write(b'property uchar red\n')
        f.write(b'property uchar green\n')
        f.write(b'property uchar blue\n')
        f.write(b'property float f_dc_0\n')
        f.write(b'property float f_dc_1\n')
        f.write(b'property float f_dc_2\n')
        f.write(b'property float opacity\n')
        f.write(b'property float scale_0\n')
        f.write(b'property float scale_1\n')
        f.write(b'property float scale_2\n')
        f.write(b'property float rot_0\n')
        f.write(b'property float rot_1\n')
        f.write(b'property float rot_2\n')
        f.write(b'property float rot_3\n')
        f.write(b'end_header\n')

        # Write vertex data with RGB colors
        for v in vertices:
            x, y, z, r, g, b, f_dc_0, f_dc_1, f_dc_2, opacity, scale_0, scale_1, scale_2, rot_0, rot_1, rot_2, rot_3 = v
            # Pack: 3 floats (xyz) + 3 uchars (rgb) + 11 floats (rest)
            f.write(struct.pack('<3f', x, y, z))
            f.write(struct.pack('<3B', r, g, b))
            f.write(struct.pack('<11f', f_dc_0, f_dc_1, f_dc_2, opacity,
                               scale_0, scale_1, scale_2, rot_0, rot_1, rot_2, rot_3))

    print(f"Converted PLY saved to {output_path}")
    print(f"Output file size: {output_path.stat().st_size / 1024 / 1024:.2f} MB")
    print(f"Added RGB colors from spherical harmonics")

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: python convert_ply.py <input.ply> <output.ply>")
        sys.exit(1)

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])

    convert_mlsharp_ply(input_path, output_path)
