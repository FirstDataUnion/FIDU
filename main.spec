# -*- mode: python ; coding: utf-8 -*-


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
    hiddenimports=[
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
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=2,  # Enable Python optimization
)
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
