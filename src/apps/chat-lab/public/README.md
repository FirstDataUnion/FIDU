# Public Assets

This directory contains static assets served with the application.

## SQL.js WASM Files

### Purpose
- `sql-wasm.js` and `sql-wasm.wasm` - SQLite WebAssembly runtime
- Used by `BrowserSQLiteManager` for local database operations
- Hosted locally (not from CDN) for security, performance, and reliability

### Why Local Hosting?
- ✅ No external CDN dependencies (works offline, no Cloudflare outage risk)
- ✅ Cleaner Content Security Policy (fewer external sources)
- ✅ Better performance (no external DNS/TLS overhead)
- ✅ Enhanced privacy (no tracking from external sources)

### Updating sql.js

When upgrading the `sql.js` npm package:

```bash
# From the chat-lab directory
cp node_modules/sql.js/dist/sql-wasm.wasm node_modules/sql.js/dist/sql-wasm.js public/
```

Current version: **1.8.0** (update this when upgrading)

### File Sizes
- `sql-wasm.wasm`: ~644 KB
- `sql-wasm.js`: ~48 KB

**Note:** These files are copied from `node_modules/sql.js/dist/` and should not be manually edited.

## Other Assets

- `chat-lab-favicon.png` - Application favicon
- `old.svg` - Legacy icon (can be removed if unused)

