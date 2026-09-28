#!/usr/bin/env python3
import os
import zipfile

def build_zip():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    public_dir = os.path.join(base_dir, 'public')
    os.makedirs(public_dir, exist_ok=True)
    zip_path = os.path.join(public_dir, 'medstore-manager.zip')

    included_files = [
        'package.json',
        'tsconfig.json',
        'vite.config.ts',
        'index.html',
        '.env.example',
        '.gitignore',
        'firebase.js',
        'server.js',
        'server.ts',
        'firebase-blueprint.json',
        'firestore.rules',
        'metadata.json',
        'serviceAccountKey.json',
        'README.md'
    ]

    included_dirs = ['src', 'backend']

    print(f"Creating ZIP archive at: {zip_path}")
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for f in included_files:
            full_path = os.path.join(base_dir, f)
            if os.path.isfile(full_path):
                zipf.write(full_path, arcname=f"medstore-manager/{f}")
                print(f"  + Added file: {f}")

        for d in included_dirs:
            full_dir_path = os.path.join(base_dir, d)
            if os.path.isdir(full_dir_path):
                for root, _, files in os.walk(full_dir_path):
                    for file in sorted(files):
                        file_path = os.path.join(root, file)
                        rel_path = os.path.relpath(file_path, base_dir)
                        zipf.write(file_path, arcname=f"medstore-manager/{rel_path}")
                        print(f"  + Added file: {rel_path}")

    size_kb = os.path.getsize(zip_path) / 1024
    print(f"Successfully generated medstore-manager.zip ({size_kb:.2f} KB)")

if __name__ == '__main__':
    build_zip()
