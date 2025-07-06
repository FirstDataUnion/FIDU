# Extension Icons

This directory should contain the following icon files for the Chrome extension:

- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)  
- `icon128.png` (128x128 pixels)

## Creating Placeholder Icons

Since the extension requires these icon files to load properly, you can create simple placeholder icons using any of these methods:

### Method 1: Online Icon Generator
1. Visit a site like https://favicon.io/favicon-generator/
2. Create a simple icon with text like "CS" (for Chatbot Saver)
3. Download and resize to the required dimensions

### Method 2: Simple HTML5 Canvas (Browser Console)
Run this in your browser console to generate a simple icon:

```javascript
function createIcon(size, text) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  // Background
  ctx.fillStyle = '#007bff';
  ctx.fillRect(0, 0, size, size);
  
  // Text
  ctx.fillStyle = 'white';
  ctx.font = `bold ${size * 0.4}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, size/2, size/2);
  
  return canvas.toDataURL('image/png');
}

// Generate icons
const icon16 = createIcon(16, 'CS');
const icon48 = createIcon(48, 'CS');
const icon128 = createIcon(128, 'CS');

console.log('Icon 16x16:', icon16);
console.log('Icon 48x48:', icon48);
console.log('Icon 128x128:', icon128);
```

### Method 3: Copy from Another Extension
You can temporarily copy icon files from any existing Chrome extension and rename them.

### Method 4: Use a Simple Image
Any square image can be resized to the required dimensions using an image editor.

## Icon Requirements

- **Format**: PNG
- **Dimensions**: Exact sizes as specified
- **Background**: Should be transparent or solid color
- **Content**: Should be recognizable at small sizes

## Testing

After creating the icons, reload the extension in Chrome to verify they display correctly in:
- Extension management page
- Browser toolbar
- Extension popup 