# -*- mode: python ; coding: utf-8 -*-

import sys
import platform

# macOS-specific configurations
if platform.system() == 'Darwin':
    # Target minimum macOS version for better compatibility
    target_macos_version = '10.15'  # Catalina - good baseline for modern apps
    
    # Additional macOS-specific hidden imports
    macos_hidden_imports = [
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'fastapi',
        'fastapi.middleware.cors',
        'fastapi.staticfiles',
        'fastapi.templating',
        'starlette.responses',
        'starlette.middleware.base',
        'jinja2',
        'sqlite3',
        # macOS-specific imports
        'Foundation',
        'AppKit',
        'CoreFoundation',
    ]
else:
    macos_hidden_imports = [
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'fastapi',
        'fastapi.middleware.cors',
        'fastapi.staticfiles',
        'fastapi.templating',
        'starlette.responses',
        'starlette.middleware.base',
        'jinja2',
        'sqlite3',
    ]

a = Analysis(
    ['src/fidu_vault/main.py'],
    pathex=[],
    binaries=[],
    datas=[
            ('src/fidu_vault/front_end/static', 'fidu_vault/front_end/static'),
    ('src/fidu_vault/front_end/templates', 'fidu_vault/front_end/templates'),
        ('src/apps/chat-lab/dist', 'apps/chat-lab/dist'),
    ],
    clean=True,
    hiddenimports=macos_hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=2,  # Enable Python optimization
)

# macOS-specific analysis options
if platform.system() == 'Darwin':
    # Exclude problematic macOS frameworks that can cause compatibility issues
    a.excludes.extend([
        'tkinter',  # Can cause issues on some macOS versions
        'matplotlib',  # If not needed
    ])

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='main',
    debug=False,
    bootloader_ignore_signals=False,
    strip=True,  # Strip debug symbols
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=True,  # Strip debug symbols
    upx=True,
    upx_exclude=[],
    name='main',
)

# macOS-specific post-processing
if platform.system() == 'Darwin':
    # Add post-processing hook for macOS compatibility
    def post_process_macos(binaries, datas, dist_dir):
        """Post-process the build for better macOS compatibility."""
        import os
        import shutil
        
        # Ensure proper permissions on the Python framework
        python_framework = os.path.join(dist_dir, 'main', 'Python')
        if os.path.exists(python_framework):
            # Set proper permissions
            os.chmod(python_framework, 0o755)
            
            # Fix any broken symlinks that might cause "damaged" errors
            for root, dirs, files in os.walk(python_framework):
                for file in files:
                    file_path = os.path.join(root, file)
                    if os.path.islink(file_path):
                        try:
                            target = os.readlink(file_path)
                            if not os.path.exists(target):
                                # Fix broken symlink
                                os.unlink(file_path)
                        except OSError:
                            pass
    
    # Register the post-processing function
    coll.post_process = post_process_macos
