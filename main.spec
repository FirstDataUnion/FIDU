# -*- mode: python ; coding: utf-8 -*-

import sys
import platform
import os

# macOS-specific configurations
if platform.system() == 'Darwin':
    # Target minimum macOS version for better compatibility
    target_macos_version = '10.15'  # Catalina - required for Python 3.8+
    
    # Check if we're building for a specific architecture
    target_arch = os.environ.get('TARGET_ARCH', None)
    build_universal = os.environ.get('BUILD_UNIVERSAL', 'false').lower() == 'true'
    
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
elif platform.system() == 'Linux':
    # Linux-specific hidden imports
    linux_hidden_imports = [
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
        # Linux-specific imports
        'fcntl',
        'termios',
        'pwd',
        'grp',
        'crypt',
        'spwd',
    ]
elif platform.system() == 'Windows':
    # Windows-specific hidden imports
    windows_hidden_imports = [
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
        # Windows-specific imports
        'win32api',
        'win32con',
        'win32gui',
        'win32process',
        'win32security',
        'win32service',
        'win32serviceutil',
        'pywintypes',
        'pythoncom',
        'msvcrt',
        'winsound',
        'winreg',
        'ctypes.wintypes',
    ]
else:
    # Default hidden imports for other platforms
    default_hidden_imports = [
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
        ('src/data_acquisition/fidu-chat-grabber', 'data_acquisition/fidu-chat-grabber'),
        ('version.yaml', '.'),  # Include version.yaml in the root of the bundle
    ],
    clean=True,
    hiddenimports=(macos_hidden_imports if platform.system() == 'Darwin' else (linux_hidden_imports if platform.system() == 'Linux' else (windows_hidden_imports if platform.system() == 'Windows' else default_hidden_imports))) + [
        'fidu_vault.versioning.version',
        'fidu_vault.versioning.version_api',
        'yaml',
        'yaml.loader',
        'yaml.dumper',
    ],
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

# Determine target architecture for macOS builds
if platform.system() == 'Darwin':
    if target_arch == 'arm64':
        target_arch = 'arm64'
        print(f"Building for ARM64 (Apple Silicon) architecture")
    elif target_arch == 'x86_64':
        target_arch = 'x86_64'
        print(f"Building for x86_64 (Intel) architecture")
    elif build_universal:
        target_arch = None  # Universal binary
        print(f"Building universal binary (Intel + Apple Silicon)")
    else:
        # Default to current system architecture
        target_arch = None
        print(f"Building for current system architecture")
else:
    target_arch = None

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='FIDU_Vault',  # Changed from 'main' to 'FIDU_Vault'
    debug=False,
    bootloader_ignore_signals=False,
    strip=True,  # Strip debug symbols
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=target_arch,  # Set target architecture for cross-compilation
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
    name='FIDU_Vault',  # Changed from 'main' to 'FIDU_Vault'
)

# Platform-specific post-processing
if platform.system() == 'Darwin':
    # Add post-processing hook for macOS compatibility
    def post_process_macos(binaries, datas, dist_dir):
        """Post-process the build for better macOS compatibility."""
        import os
        import shutil
        
        # Ensure proper permissions on the Python framework
        python_framework = os.path.join(dist_dir, 'FIDU_Vault', 'Python')
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
        
        # Add architecture information to the build
        if target_arch:
            arch_file = os.path.join(dist_dir, 'FIDU_Vault', 'ARCHITECTURE.txt')
            with open(arch_file, 'w') as f:
                f.write(f"Built for: {target_arch}\n")
                f.write(f"Build system: {platform.machine()}\n")
                f.write(f"Target macOS: {target_macos_version}+\n")
        elif build_universal:
            arch_file = os.path.join(dist_dir, 'FIDU_Vault', 'ARCHITECTURE.txt')
            with open(arch_file, 'w') as f:
                f.write("Built for: Universal (Intel + Apple Silicon)\n")
                f.write(f"Build system: {platform.machine()}\n")
                f.write(f"Target macOS: {target_macos_version}+\n")
    
    # Register the post-processing function
    coll.post_process = post_process_macos

elif platform.system() == 'Linux':
    # Add post-processing hook for Linux compatibility
    def post_process_linux(binaries, datas, dist_dir):
        """Post-process the build for better Linux compatibility."""
        import os
        import stat
        
        # Ensure proper permissions on the executable
        executable = os.path.join(dist_dir, 'FIDU_Vault', 'FIDU_Vault')
        if os.path.exists(executable):
            # Set executable permissions
            os.chmod(executable, stat.S_IRWXU | stat.S_IRGRP | stat.S_IXGRP | stat.S_IROTH | stat.S_IXOTH)
        
        # Add architecture information to the build
        if target_arch:
            arch_file = os.path.join(dist_dir, 'FIDU_Vault', 'ARCHITECTURE.txt')
            with open(arch_file, 'w') as f:
                f.write(f"Built for: {target_arch}\n")
                f.write(f"Build system: {platform.machine()}\n")
                f.write("Target Linux: Generic\n")
        elif build_universal:
            arch_file = os.path.join(dist_dir, 'FIDU_Vault', 'ARCHITECTURE.txt')
            with open(arch_file, 'w') as f:
                f.write("Built for: Universal (Multiple architectures)\n")
                f.write(f"Build system: {platform.machine()}\n")
                f.write("Target Linux: Generic\n")
    
    # Register the post-processing function
    coll.post_process = post_process_linux

elif platform.system() == 'Windows':
    # Add post-processing hook for Windows compatibility
    def post_process_windows(binaries, datas, dist_dir):
        """Post-process the build for better Windows compatibility."""
        import os
        import stat
        
        # Ensure proper permissions on the executable
        executable = os.path.join(dist_dir, 'FIDU_Vault', 'FIDU_Vault.exe')
        if os.path.exists(executable):
            # Set executable permissions
            os.chmod(executable, stat.S_IRWXU | stat.S_IRGRP | stat.S_IXGRP | stat.S_IROTH | stat.S_IXOTH)
        
        # Add architecture information to the build
        if target_arch:
            arch_file = os.path.join(dist_dir, 'FIDU_Vault', 'ARCHITECTURE.txt')
            with open(arch_file, 'w') as f:
                f.write(f"Built for: {target_arch}\n")
                f.write(f"Build system: {platform.machine()}\n")
                f.write("Target Windows: 10+\n")
        elif build_universal:
            arch_file = os.path.join(dist_dir, 'FIDU_Vault', 'ARCHITECTURE.txt')
            with open(arch_file, 'w') as f:
                f.write("Built for: Universal (Multiple architectures)\n")
                f.write(f"Build system: {platform.machine()}\n")
                f.write("Target Windows: 10+\n")
    
    # Register the post-processing function
    coll.post_process = post_process_windows
