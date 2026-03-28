# Penpot Visual Fetch Plugin

## What this is

A Penpot plugin that reads the clipboard JSON produced by the **penpot-visual-fetch**
Chrome extension and reconstructs the Captured DOM tree as native Penpot
layers (frames, rectangles, text, images, SVGs).

## Project layout

```
plugin.js       Plugin logic — runs in Penpot's plugin sandbox (global: penpot)
index.html      Plugin UI — served by server.js, opened via penpot.ui.open()
manifest.json   Penpot plugin manifest (host, code entry, permissions)
server.js       Local dev HTTP server on port 7654
package.json    start script: node server.js
```

## Running locally

```
npm start   # starts server.js on http://localhost:7654
```

Load the plugin in Penpot by pointing to `http://localhost:7654/manifest.json`.

## Penpot Plugin API reference

The global `penpot` object is available only inside `plugin.js`.

| Resource                              | URL                                                                  |
| ------------------------------------- | -------------------------------------------------------------------- |
| `Penpot` interface (main entry point) | https://doc.plugins.penpot.app/interfaces/Penpot.html                |
| All types index                       | https://doc.plugins.penpot.app/modules.html                          |
| `Page` interface                      | https://doc.plugins.penpot.app/interfaces/Page.html                  |
| `ShapeBase` interface                 | https://doc.plugins.penpot.app/interfaces/ShapeBase.html             |
| `Board` interface                     | https://doc.plugins.penpot.app/interfaces/Board.html                 |
| `Text` interface                      | https://doc.plugins.penpot.app/interfaces/Text.html                  |
| `TextRange` interface                 | https://doc.plugins.penpot.app/interfaces/TextRange.html             |
| `Fill` interface                      | https://doc.plugins.penpot.app/interfaces/Fill.html                  |
| `Stroke` interface                    | https://doc.plugins.penpot.app/interfaces/Stroke.html                |
| `Shadow` interface                    | https://doc.plugins.penpot.app/interfaces/Shadow.html                |
| `FlexLayout` interface                | https://doc.plugins.penpot.app/interfaces/FlexLayout.html            |
| `GridLayout` interface                | https://doc.plugins.penpot.app/interfaces/GridLayout.html            |
| `LayoutChildProperties`               | https://doc.plugins.penpot.app/interfaces/LayoutChildProperties.html |
| `ImageData` type                      | https://doc.plugins.penpot.app/types/ImageData.html                  |
| `Group` interface                     | https://doc.plugins.penpot.app/interfaces/Group.html                 |

### UI

<!-- https://doc.plugins.penpot.app/interfaces/Penpot.html#ui -->

```js
penpot.ui.open(name, url, { width, height }); // open the plugin panel
penpot.ui.sendMessage(msg); // plugin → UI
penpot.ui.onMessage(callback); // UI → plugin
penpot.ui.resize(width, height);
```

### Context / page

<!-- https://doc.plugins.penpot.app/interfaces/Page.html -->

```js
penpot.currentPage; // Page | null  (requires content:read)
penpot.currentPage.root; // root Shape of the page
penpot.selection; // Shape[]  currently selected shapes
penpot.root; // root shape of the file
```

### Shape creation (requires `content:write`)

<!-- https://doc.plugins.penpot.app/interfaces/Penpot.html#createRectangle -->

```js
penpot.createRectangle(); // Rectangle
penpot.createBoard(); // Board  (= frame in the UI)
penpot.createEllipse(); // Ellipse
penpot.createPath(); // Path
penpot.createText(text); // Text | null
penpot.createShapeFromSvg(svgString); // Group | null
penpot.createShapeFromSvgWithImages(svgString); // Promise<Group | null>
penpot.createBoolean(type, shapes); // Boolean | null
penpot.group(shapes); // Group | null
penpot.ungroup(group, ...others);
```

### Media upload (requires `content:write`)

<!-- https://doc.plugins.penpot.app/interfaces/Penpot.html#uploadMediaUrl -->

```js
const img = await penpot.uploadMediaUrl(name, url); // ImageData
const img = await penpot.uploadMediaData(name, uint8, mime);
// Use as fill:
shape.fills = [{ fillImage: img, fillOpacity: 1 }];
```

### Common shape properties

<!-- https://doc.plugins.penpot.app/interfaces/ShapeBase.html -->

```js
shape.name;
shape.x;
shape.y;
shape.resize(w, h);
shape.fills; // Fill[]
shape.strokes; // Stroke[]
shape.shadows; // Shadow[]
shape.blur; // { type: "layer-blur", value, hidden }
shape.opacity; // 0–1
shape.blendMode;
shape.rotation;
shape.borderRadius;
shape.borderRadiusTopLeft / TopRight / BottomRight / BottomLeft;
shape.clipContent; // Board only
shape.appendChild(child);
```

### Fill types

<!-- https://doc.plugins.penpot.app/interfaces/Fill.html -->

```js
// Solid
{ fillColor: "#rrggbb", fillOpacity: 1 }
// Gradient
{ fillColorGradient: { type, startX, startY, endX, endY, width, stops }, fillOpacity }
// Image
{ fillImage: ImageData, fillOpacity: 1 }
```

### Stroke

<!-- https://doc.plugins.penpot.app/interfaces/Stroke.html -->

```js
{
  (strokeColor,
    strokeOpacity,
    strokeWidth,
    strokeStyle, // "solid" | "dashed" | "dotted" | "mixed" | "none"
    strokeAlignment); // "inner" | "outer" | "center"
}
```

### Shadow

<!-- https://doc.plugins.penpot.app/interfaces/Shadow.html -->

```js
{
  style,   // "drop-shadow" | "inner-shadow"
  offsetX, offsetY, blur, spread,
  color: { color, opacity },
  hidden
}
```

### Text shape properties

<!-- https://doc.plugins.penpot.app/interfaces/Text.html -->
<!-- https://doc.plugins.penpot.app/interfaces/TextRange.html -->

```js
shape.fontFamily
shape.fontSize    // string e.g. "14"
shape.fontWeight  // string e.g. "700"
shape.fontVariantId   // "regular" | "bold" | "italic" | "bolditalic"
shape.fontStyle       // "normal" | "italic"
shape.lineHeight      // string
shape.letterSpacing   // string
shape.align           // "left" | "center" | "right" | "justify"
shape.textDecoration  // "underline" | "line-through" | "none"
shape.textTransform   // "uppercase" | "lowercase" | "capitalize" | "none"
shape.growType        // "fixed" | "auto-width" | "auto-height"
shape.verticalSizing  // "fixed" | "auto"
shape.horizontalSizing
// Per-run styled ranges:
const range = shape.getRange(start, end)
range.fontFamily; range.fontSize; range.fontWeight; ...
```

### Layout (Board only)

<!-- https://doc.plugins.penpot.app/interfaces/FlexLayout.html -->
<!-- https://doc.plugins.penpot.app/interfaces/GridLayout.html -->

```js
// Flex
board.addFlexLayout();
// Grid
board.addGridLayout();
// After adding layout, read/write board.layout.*
// layout.dir, layout.alignItems, layout.justifyContent, layout.gap, ...
```

### Layout child sizing

<!-- https://doc.plugins.penpot.app/interfaces/LayoutChildProperties.html -->

```js
shape.horizontalSizing; // "fill" | "fix" | "auto"
shape.verticalSizing;
shape.alignSelf; // "start" | "center" | "end" | "stretch"
```

### Events

<!-- https://doc.plugins.penpot.app/interfaces/EventsMap.html -->

```js
penpot.on("pagechange", cb);
penpot.on("selectionchange", cb);
penpot.on("shapechange", cb, { shapeId });
penpot.on("themechange", cb);
penpot.off(listenerId);
```

## Message protocol between UI and plugin

| Direction   | Message                       | Meaning                                  |
| ----------- | ----------------------------- | ---------------------------------------- |
| UI → plugin | `{ type: "build", Capture }` | Start building shapes from Capture JSON |
| UI → plugin | `{ type: "cancel" }`          | Abort in-progress build                  |
| plugin → UI | `{ type: "progress", value }` | 0–100 progress update                    |
| plugin → UI | `{ type: "done" }`            | Build finished successfully              |
| plugin → UI | `{ type: "cancelled" }`       | Build aborted                            |
| plugin → UI | `{ type: "error", message }`  | Error string                             |

## Key conventions

- All Penpot API calls that can throw (e.g. unsupported shape properties) must
  be wrapped in `try/catch` — the API surface changes across Penpot versions.
- `penpot.createText(text)` requires a non-empty string; pass at least `" "`.
- `shape.resize()` args must be `>= 1`; use `Math.max(1, value)`.
- `board.appendChild(child)` must be called **after** the board is added to the
  page; otherwise layout child properties are not writable.
- Always call `penpot.ui.sendMessage({ type: "done" })` when the build is
  complete so the UI can re-enable its buttons.
- The plugin manifest requires permissions `["content:read","content:write","allow:downloads"]`.
