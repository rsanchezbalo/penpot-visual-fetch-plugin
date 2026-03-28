# Penpot Visual Fetch

Penpot Visual Fetch is a two-part tool — a Chrome extension and a Penpot plugin — that lets you Capture any live web element and paste it into Penpot as fully editable native layers.

## Features

**Full DOM-to-Layers Reconstruction:** Converts a Captured web element into a native Penpot layer tree including frames, rectangles, text, images, SVGs, and video placeholders.

**Clipboard-Based Workflow:** The Chrome extension copies a rich JSON Capture to your clipboard. The plugin reads it on paste — no special clipboard permissions required.

**Rich Styling Support:**
- Solid, gradient, and image fills
- Strokes with alignment (inner / center / outer), style, and width
- Drop shadows and inner shadows
- Border radius (uniform or per-corner)
- Opacity, blend modes, rotation
- Layer blur and backdrop blur

**Layout Reconstruction:**
- Flex layout (direction, wrap, alignment, gap, padding)
- CSS Grid layout (columns, rows, gap, alignment)
- Layout child sizing (`fill`, `fix`, `auto`) and `alignSelf`
- Grid cell placement (column, row, span)

**Advanced Text Handling:**
- Case-insensitive font family lookup with fallback chain (Inter → Source Sans Pro → Roboto)
- Font weight, style, size, line height, letter spacing
- Text alignment, decoration, and transform
- Per-run inline styling (mixed fonts and colors in the same text node)

**Media Upload:** Images and SVGs are automatically uploaded to Penpot's media library and set as image fills.

**Progress & Control:**
- Real-time progress bar during build
- Cancel button to abort an in-progress import
- Font warning listing any font families not found in Penpot's registry

**Theme-Aware UI:** Automatically follows Penpot's dark or light theme.

## How to Use

### 1. Capture an element with the Chrome extension

1. Click the **Penpot Visual Fetch** extension icon in Chrome
2. Hover over the page to highlight elements
3. Use **↑ / ↓** to navigate to a parent or child element
4. Press **↵** to confirm the selection — the Capture is copied to your clipboard
5. Press **Esc** to cancel

### 2. Import into Penpot

1. Open the **Penpot Visual Fetch** plugin in Penpot
2. Click the paste area in the plugin panel
3. Press **Ctrl+V** to paste the Capture
4. Review the element name, dimensions, and any font warnings
5. Click **Build in Penpot** to reconstruct the element as native layers

The imported frame is placed below any existing content on the current page, with a 32 px gap.

## UI Controls

| Control | Description |
|---|---|
| Paste area | Click then press Ctrl+V to load a Capture from the clipboard |
| Font warning | Shown before building if any fonts are not available in Penpot |
| Build in Penpot | Starts the shape reconstruction; shows progress bar |
| Clear | Discards the loaded Capture |
| Cancel | Aborts the build currently in progress |

## Development

### Getting Started

1. Clone this repository
2. Install dependencies: `npm install`
3. Start the local server: `npm start`

The server runs at `http://localhost:7654`.

### Loading the Plugin in Penpot

1. Open Penpot and press **Ctrl + Alt + P** to open the Plugin Manager
2. Enter the manifest URL: `http://localhost:7654/manifest.json`
3. Install and use the plugin

### Project Structure

```
plugin.js       Plugin logic — runs in Penpot's plugin sandbox
index.html      Plugin UI — opened via penpot.ui.open()
manifest.json   Penpot plugin manifest (host, code entry, permissions)
server.js       Static HTTP server on port 7654
package.json    start script: node server.js
```

### Key Functions

| Function | Description |
|---|---|
| `buildFromCapture(Capture)` | Entry point — validates the Capture and starts the recursive build |
| `buildShape(node, parent, offsetX, offsetY)` | Recursively creates Penpot shapes from a Capture node |
| `buildTextShape(textItem, offsetX, offsetY)` | Creates a text shape with font, size, alignment, and styling |
| `applyTextRuns(shape, textItem)` | Applies per-run inline styles (font, color) after the shape is in the document tree |
| `applyFlexLayout(frame, layout)` | Attaches a flex layout to a board with all CSS flex properties |
| `applyGridLayout(frame, layout)` | Attaches a grid layout with column/row track definitions |
| `uploadMedia(name, url)` | Uploads an image URL or data URI to Penpot's media library with deduplication caching |
| `findFont(rawName)` | Case-insensitive font lookup with CSS quote stripping |
| `mapFills / mapStrokes / mapShadows` | Convert Capture styling objects to Penpot API format |

### Technical Implementation

The plugin uses the Penpot Plugin API to:

- Access the current page via `penpot.currentPage`
- Create shapes using `penpot.createBoard()`, `penpot.createRectangle()`, `penpot.createText()`, and `penpot.createShapeFromSvgWithImages()`
- Upload media assets with `penpot.uploadMediaUrl()` and `penpot.uploadMediaData()`
- Apply fills, strokes, shadows, and layout through shape property setters
- Communicate with the plugin UI via `penpot.ui.sendMessage()` and `penpot.ui.onMessage()`

> **Note:** All Penpot API calls that may throw (unsupported properties vary across Penpot versions) are wrapped in `try/catch` to keep the build resilient.

### Message Protocol

| Direction | Message | Meaning |
|---|---|---|
| UI → plugin | `{ type: "build", Capture }` | Start building shapes from Capture JSON |
| UI → plugin | `{ type: "cancel" }` | Abort in-progress build |
| UI → plugin | `{ type: "check-fonts", fonts }` | Pre-check font availability before building |
| plugin → UI | `{ type: "progress", value }` | 0–100 progress update |
| plugin → UI | `{ type: "done", missingFonts }` | Build finished; lists any unresolved font families |
| plugin → UI | `{ type: "cancelled" }` | Build aborted |
| plugin → UI | `{ type: "error", message }` | Error string |
| plugin → UI | `{ type: "fonts-checked", missing }` | Font availability result |

## License

This project is licensed under the MIT License 
