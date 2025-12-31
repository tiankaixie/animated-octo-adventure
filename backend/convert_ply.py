# Input: ml-sharp PLY file
# Output: Standard Gaussian Splatting PLY file
# Pos: Converter to remove extra elements from ml-sharp PLY for GaussianSplats3D compatibility

import struct
import sys
from pathlib import Path

def convert_mlsharp_ply(input_path: Path, output_path: Path):
    """Convert ml-sharp PLY to standard Gaussian Splatting PLY format"""

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

    # Write output file with clean header
    with open(output_path, 'wb') as f:
        # Write standard header matching 3D Gaussian Splatting format
        f.write(b'ply\n')
        f.write(b'format binary_little_endian 1.0\n')
        f.write(f'element vertex {vertex_count}\n'.encode('ascii'))
        f.write(b'property float x\n')
        f.write(b'property float y\n')
        f.write(b'property float z\n')
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

        # Write vertex data as-is
        f.write(vertex_data)

    print(f"Converted PLY saved to {output_path}")
    print(f"Output file size: {output_path.stat().st_size / 1024 / 1024:.2f} MB")

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: python convert_ply.py <input.ply> <output.ply>")
        sys.exit(1)

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])

    convert_mlsharp_ply(input_path, output_path)
