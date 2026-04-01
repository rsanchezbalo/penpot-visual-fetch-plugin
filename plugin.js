// Penpot Visual Fetch Plugin v2
// Builds Penpot shapes from the rich JSON produced by the Chrome extension

penpot.ui.open("Penpot Visual Fetch", "index.html", {
  width: 320,
  height: 420,
});

// Propagate theme changes to the UI iframe
penpot.on("themechange", (theme) => {
  penpot.ui.sendMessage({ type: "theme", content: theme });
});

let cancelled = false;

// ─── Alignment mapping ────────────────────────────────────────────────────────

function alignMap(css) {
  const m = {
    "flex-start": "start",
    "flex-end": "end",
    start: "start",
    end: "end",
    center: "center",
    stretch: "stretch",
    baseline: "start",
    normal: "start",
    "space-between": "space-between",
    "space-around": "space-around",
    "space-evenly": "space-evenly",
  };
  return m[css] || "start";
}

// ─── Fills ───────────────────────────────────────────────────────────────────

function mapFills(rawFills) {
  if (!rawFills || !rawFills.length) return [];
  return rawFills.map((f) => {
    if (f.fillColorGradient) {
      const g = f.fillColorGradient;
      return {
        fillColorGradient: {
          type: g.type,
          startX: g.startX,
          startY: g.startY,
          endX: g.endX,
          endY: g.endY,
          width: g.width || 1,
          stops: (g.stops || []).map((s) => ({
            color: s.color,
            opacity: s.opacity !== undefined ? s.opacity : 1,
            offset: s.position !== undefined ? s.position : s.offset,
          })),
        },
        fillOpacity: f.fillOpacity || 1,
      };
    }
    return {
      fillColor: f.fillColor || "#000000",
      fillOpacity: f.fillOpacity !== undefined ? f.fillOpacity : 1,
    };
  });
}

// ─── Strokes ─────────────────────────────────────────────────────────────────

function mapStrokes(rawStrokes) {
  if (!rawStrokes || !rawStrokes.length) return [];
  return rawStrokes.map((s) => ({
    strokeAlignment:
      s.strokePosition === "outer"
        ? "outer"
        : s.strokePosition === "center"
          ? "center"
          : "inner",
    strokeColor: s.strokeColor || "#000000",
    strokeOpacity: s.strokeOpacity !== undefined ? s.strokeOpacity : 1,
    strokeWidth: s.strokeWidth || 1,
    strokeStyle: s.strokeStyle || "solid",
  }));
}

// ─── Shadows ─────────────────────────────────────────────────────────────────

function mapShadows(rawShadows) {
  if (!rawShadows || !rawShadows.length) return [];
  return rawShadows.map((s) => ({
    style: s.type === "inset" ? "inner-shadow" : "drop-shadow",
    offsetX: s.offsetX || 0,
    offsetY: s.offsetY || 0,
    blur: s.blur || 0,
    spread: s.spread || 0,
    color: {
      color: s.hex || "#000000",
      opacity: s.a !== undefined ? s.a : 0.25,
    },
    hidden: false,
  }));
}

// ─── Border radius ────────────────────────────────────────────────────────────

function applyBorderRadius(shape, br) {
  if (!br) return;
  try {
    if (br.all !== undefined) {
      shape.borderRadius = br.all;
    } else {
      shape.borderRadiusTopLeft = br.tl || 0;
      shape.borderRadiusTopRight = br.tr || 0;
      shape.borderRadiusBottomRight = br.br || 0;
      shape.borderRadiusBottomLeft = br.bl || 0;
    }
  } catch (_) {}
}

// ─── Font variant ID ─────────────────────────────────────────────────────────

function toFontVariantId(weight, style) {
  const w = parseInt(weight) || 400;
  const italic = (style || "").toLowerCase().includes("italic");
  if (w >= 700 && italic) return "bolditalic";
  if (w >= 700) return "bold";
  if (italic) return "italic";
  return "regular";
}

// ─── Apply common shape styles ────────────────────────────────────────────────

function applyCommonStyles(shape, node) {
  const fills = mapFills(node.fills);
  // Never set fills=[] — Penpot rejects empty fills on text shapes (:malli.core/invalid-schema)
  if (fills.length) {
    try {
      shape.fills = fills;
    } catch (e) {
      console.warn("[PenpotVF] fills set failed:", e.message);
    }
  }

  const strokes = mapStrokes(node.strokes);
  if (strokes.length) shape.strokes = strokes;

  const shadows = mapShadows(node.shadows);
  if (shadows.length) shape.shadows = shadows;

  applyBorderRadius(shape, node.borderRadius);

  if (node.opacity !== undefined && node.opacity < 1) {
    shape.opacity = node.opacity;
  }

  if (node.blendMode) {
    const blendMap = {
      multiply: "multiply",
      screen: "screen",
      overlay: "overlay",
      darken: "darken",
      lighten: "lighten",
      "color-dodge": "color-dodge",
      "color-burn": "color-burn",
      "hard-light": "hard-light",
      "soft-light": "soft-light",
      difference: "difference",
      exclusion: "exclusion",
      hue: "hue",
      saturation: "saturation",
      color: "color",
      luminosity: "luminosity",
    };
    const mapped = blendMap[node.blendMode];
    if (mapped)
      try {
        shape.blendMode = mapped;
      } catch (_) {}
  }

  if (node.rotation) {
    shape.rotation = node.rotation;
  }

  if (node.blur) {
    try {
      shape.blur = {
        type: "layer-blur",
        value: node.blur,
        hidden: false,
      };
    } catch (_) {}
  }

  if (node.backdropBlur) {
    try {
      shape.blur = {
        type: "background-blur",
        value: node.backdropBlur,
        hidden: false,
      };
    } catch (_) {}
  }
}

// ─── Apply size ───────────────────────────────────────────────────────────────

function applyLayoutChildSizing(shape, lc) {
  if (!lc) return;
  if (lc.absolute) return; // absolutely positioned, sizing doesn't apply

  // layoutChild only exists after the shape is appended to a layout parent
  const lcp = shape.layoutChild;
  if (!lcp) return;

  if (lc.horizontalSizing)
    try {
      lcp.horizontalSizing = lc.horizontalSizing;
    } catch (_) {}
  if (lc.verticalSizing)
    try {
      lcp.verticalSizing = lc.verticalSizing;
    } catch (_) {}
  if (lc.alignSelf) {
    // LayoutChildProperties.alignSelf: 'auto'|'start'|'end'|'center'|'stretch'
    const selfMap = {
      "flex-start": "start",
      "flex-end": "end",
      start: "start",
      end: "end",
      center: "center",
      stretch: "stretch",
      baseline: "start",
      normal: "auto",
      auto: "auto",
    };
    try {
      lcp.alignSelf = selfMap[lc.alignSelf] || "auto";
    } catch (_) {}
  }
}

// ─── Flex layout ─────────────────────────────────────────────────────────────

function applyFlexLayout(frame, layout) {
  const fl = frame.addFlexLayout();

  const dirMap = {
    row: "row",
    "row-reverse": "row-reverse",
    column: "column",
    "column-reverse": "column-reverse",
  };
  fl.dir = dirMap[layout.direction] || "row";
  fl.wrap = layout.wrap === "wrap" ? "wrap" : "nowrap";
  try {
    fl.alignItems = alignMap(layout.alignItems || "flex-start");
  } catch (_) {}
  try {
    fl.justifyContent = alignMap(layout.justifyContent || "flex-start");
  } catch (_) {}
  if (layout.alignContent)
    try {
      fl.alignContent = alignMap(layout.alignContent);
    } catch (_) {}

  fl.rowGap = layout.rowGap || 0;
  fl.columnGap = layout.columnGap || 0;

  fl.topPadding = layout.paddingTop || 0;
  fl.rightPadding = layout.paddingRight || 0;
  fl.bottomPadding = layout.paddingBottom || 0;
  fl.leftPadding = layout.paddingLeft || 0;

  return fl;
}

// ─── Grid layout ─────────────────────────────────────────────────────────────

function applyGridLayout(frame, layout) {
  const gl = frame.addGridLayout();

  if (layout.columns && layout.columns.length) {
    for (const c of layout.columns) {
      if (c.type === "flex") gl.addColumn("flex", c.value);
      else if (c.type === "auto") gl.addColumn("auto");
      else gl.addColumn("fixed", c.value || 100);
    }
  }

  if (layout.rows && layout.rows.length) {
    for (const r of layout.rows) {
      if (r.type === "flex") gl.addRow("flex", r.value);
      else if (r.type === "auto") gl.addRow("auto");
      else gl.addRow("fixed", r.value || 100);
    }
  }

  gl.rowGap = layout.rowGap || 0;
  gl.columnGap = layout.columnGap || 0;
  gl.alignItems = alignMap(layout.alignItems || "start");
  try {
    gl.justifyItems = alignMap(layout.justifyItems || "start");
  } catch (_) {}

  gl.topPadding = layout.paddingTop || 0;
  gl.rightPadding = layout.paddingRight || 0;
  gl.bottomPadding = layout.paddingBottom || 0;
  gl.leftPadding = layout.paddingLeft || 0;

  return gl;
}

// ─── Apply grid child placement ───────────────────────────────────────────────

// ─── Font resolver with case-insensitive fallback ─────────────────────────────
// penpot.fonts.findByName() is case-sensitive. Many CSS font stacks use
// quoted names or inconsistent casing (e.g. "Work sans" vs "Work Sans").
// This tries exact match first, then case-insensitive, then fontFamily field.
function findFont(rawName) {
  // Strip surrounding quotes (single, double, or typographic) that CSS may include
  const name = rawName
    .replace(
      /^["'\u2018\u2019\u201c\u201d]+|["'\u2018\u2019\u201c\u201d]+$/g,
      "",
    )
    .trim();

  // 1. Exact match on cleaned name
  const exact = penpot.fonts.findByName(name);
  if (exact) return exact;

  const lower = name.toLowerCase();

  // 2. Case-insensitive match on font name
  const ciName = penpot.fonts.all.find((f) => f.name.toLowerCase() === lower);
  if (ciName) return ciName;

  // 3. Case-insensitive match on fontFamily field
  const ciFamily = penpot.fonts.all.find(
    (f) => f.fontFamily.toLowerCase() === lower,
  );
  if (ciFamily) return ciFamily;

  console.warn("[PenpotVF] findFont: no match for:", JSON.stringify(rawName));
  return null;
}

function applyGridChildPlacement(shape, lc) {
  if (!lc) return;
  const cell = shape.layoutCell;
  if (!cell) return; // only exists after appendToParent in grid context
  try {
    if (lc.column !== undefined || lc.row !== undefined) {
      cell.position = "manual";
    }
    if (lc.column !== undefined) cell.column = lc.column;
    if (lc.row !== undefined) cell.row = lc.row;
    if (lc.columnSpan !== undefined) cell.columnSpan = lc.columnSpan;
    if (lc.rowSpan !== undefined) cell.rowSpan = lc.rowSpan;
  } catch (_) {}
}

// ─── Apply font + color AFTER appendChild ───────────────────────────────────
// Everything that touches fontId or fills MUST happen after the shape is in
// the document tree.
// Per official Penpot sample: set fontId FIRST via direct property, then
// fontStyle/fontWeight/fontSize AFTER.  Do NOT use applyToText().
function applyTextFontAndColor(shape, textItem) {
  const fontFamily = (textItem.fontFamily || "Source Sans Pro")
    .replace(/["'\u2018\u2019\u201c\u201d]+/g, "")
    .split(",")[0]
    .trim();
  const fontWeight = String(textItem.fontWeight || "400");
  const isItalic = (textItem.fontStyle || "").toLowerCase().includes("italic");

  // ── 1. Font identity — fontId MUST come first ──
  const penpotFont = findFont(fontFamily);
  if (penpotFont) {
    const targetStyle = isItalic ? "italic" : "normal";
    const variant =
      penpotFont.variants.find(
        (v) => v.fontWeight === fontWeight && v.fontStyle === targetStyle,
      ) ||
      penpotFont.variants.find((v) => v.fontWeight === fontWeight) ||
      penpotFont.variants[0];

    // fontId first — everything else after (official Penpot guidance)
    shape.fontId = penpotFont.fontId;
    shape.fontFamily = penpotFont.fontFamily;
    if (variant) {
      shape.fontVariantId = variant.fontVariantId;
      shape.fontWeight = variant.fontWeight;
      shape.fontStyle = variant.fontStyle || "normal";
    } else {
      shape.fontWeight = fontWeight;
      shape.fontStyle = isItalic ? "italic" : "normal";
      try {
        shape.fontVariantId = toFontVariantId(fontWeight, textItem.fontStyle);
      } catch (_) {}
    }
  } else {
    unresolvedFonts.add(fontFamily);
    // Try a fallback font so the shape gets a valid fontId
    const FALLBACK_FONTS = ["Inter", "Source Sans Pro", "Roboto"];
    let fallbackApplied = false;
    for (const fb of FALLBACK_FONTS) {
      const fbFont = findFont(fb);
      if (fbFont) {
        shape.fontId = fbFont.fontId;
        shape.fontFamily = fbFont.fontFamily;
        fallbackApplied = true;
        break;
      }
    }
    // Override with the desired family/weight even if font file is missing
    shape.fontFamily = fontFamily;
    shape.fontWeight = fontWeight;
    shape.fontStyle = isItalic ? "italic" : "normal";
    try {
      shape.fontVariantId = toFontVariantId(fontWeight, textItem.fontStyle);
    } catch (_) {}
  }

  // ── 2. Text formatting (AFTER fontId so Penpot knows the font context) ──
  shape.fontSize = String(textItem.fontSize || 14);

  if (textItem.lineHeight) {
    try {
      shape.lineHeight = textItem.lineHeight;
    } catch (_) {}
  }

  if (textItem.letterSpacing !== undefined && textItem.letterSpacing !== null) {
    const originalLS = Number(textItem.letterSpacing);
    const ls = Math.max(0, originalLS);
    try {
      shape.letterSpacing = ls;
    } catch (_) {}
  }

  const rawAlign = textItem.textAlign || "left";
  const alignCssMap = {
    start: "left",
    end: "right",
    "-webkit-left": "left",
    "-webkit-right": "right",
    "-webkit-center": "center",
  };
  const textAlign = alignCssMap[rawAlign] || rawAlign;
  if (["left", "center", "right", "justify"].includes(textAlign)) {
    try {
      shape.align = textAlign;
    } catch (_) {}
  }

  const textDec = textItem.textDecoration || "";
  if (textDec.includes("underline")) {
    try {
      shape.textDecoration = "underline";
    } catch (_) {}
  } else if (textDec.includes("line-through")) {
    try {
      shape.textDecoration = "line-through";
    } catch (_) {}
  }

  if (textItem.textTransform && textItem.textTransform !== "none") {
    try {
      shape.textTransform = textItem.textTransform;
    } catch (_) {}
  }

  // ── 3. Color ──
  applyTextColor(shape, textItem);

  // ── 4. Per-run styling (color/font overrides) ──
  try {
    applyTextRuns(shape, textItem);
  } catch (_) {}

  // ── 5. Final resize — MUST come LAST ──
  // Setting fontId/fontSize/letterSpacing above may cause Penpot to
  // recalculate text layout and change the box size. Re-apply the desired
  // width AFTER all properties are set.
  {
    let finalW = (textItem.w || 200) * 1.05; // 5% base buffer
    // Extra compensation for clamped negative letterSpacing
    const origLS = Number(textItem.letterSpacing) || 0;
    if (origLS < 0) {
      const charCount = (textItem.content || "").length;
      const extraWidth = (0 - origLS) * charCount;
      finalW += extraWidth * 1.5;
    }
    try {
      shape.resize(Math.max(1, finalW), Math.max(1, textItem.h || 20));
    } catch (_) {}
  }
}

function buildTextShape(textItem, offsetX, offsetY) {
  const content = (textItem.content || "").trim();
  if (!content) return null;

  const shape = penpot.createText(content);
  if (!shape) return null;

  shape.x = (textItem.x || 0) + offsetX;
  shape.y = (textItem.y || 0) + offsetY;
  // Add a width buffer (5%) to all text shapes to account for
  // cross-engine rendering differences between Chrome and Penpot.
  const baseW = textItem.w || 200;
  shape.resize(Math.max(1, baseW * 1.05), Math.max(1, textItem.h || 20));

  // NOTE: ALL formatting (fontSize, lineHeight, font, color, etc.) is applied
  // AFTER appendChild via applyTextFontAndColor(). Setting them here would
  // create internal content nodes with the default font (sourcesanspro),
  // causing "missing font" in the Penpot UI.

  // Text shadows
  if (textItem.textShadows && textItem.textShadows.length) {
    try {
      shape.shadows = mapShadows(
        textItem.textShadows.map((ts) => ({
          ...ts,
          type: ts.type || "outset",
        })),
      );
    } catch (_) {}
  }

  // Text strokes (-webkit-text-stroke)
  if (textItem.textStrokes && textItem.textStrokes.length) {
    try {
      shape.strokes = mapStrokes(textItem.textStrokes);
    } catch (_) {}
  }

  return shape;
}

// ─── Apply text color ─────────────────────────────────────────────────────────

// NOTE: shape.fills is used instead of range.fills.
// In Penpot 2.14.1-RC1 the text range fills setter calls sm/validate with
// types.fills/schema:fill which references types.color/schema:hex-color —
// that sub-schema is not registered at runtime, causing malli to throw
// :malli.core/invalid-schema. shape.fills uses a different validation path
// (ShapeBase) that works correctly.
//
// IMPORTANT: call this AFTER appendChild. Setting shape.fills before append
// destroys the internal fontId, causing "missing font" in the Penpot UI.
function applyTextColor(shape, textItem) {
  if (!textItem) return;
  // Always apply the base color — applyTextRuns will override per-run colors post-append
  const color = textItem.color || "#000000";
  const opacity =
    textItem.colorOpacity !== undefined ? textItem.colorOpacity : 1;
  if (!color && !textItem.textFill) return;
  // Primary: use gradient fill if available
  if (textItem.textFill) {
    try {
      const mapped = mapFills([textItem.textFill]).filter(Boolean);
      if (mapped.length) {
        shape.fills = mapped;
        return;
      }
    } catch (e) {
      console.warn("[PenpotVF] gradient fill failed, falling back:", e.message);
    }
  }
  // Solid color via shape.fills (NOT range.fills — see note above)
  try {
    shape.fills = [{ fillColor: color, fillOpacity: opacity }];
  } catch (e) {
    console.warn("[PenpotVF] shape.fills failed:", e.message);
    try {
      shape.fills = [{ fillColor: color }];
    } catch (e2) {
      console.warn("[PenpotVF] shape.fills fallback failed:", e2.message);
    }
  }
}

// ─── Apply per-run styling AFTER shape is in the document tree ────────────────
// shape.getRange() requires the shape to be appended before it can be used.
// This handles inline font variants, per-run colors, letterSpacing per run.
function applyTextRuns(shape, textItem) {
  if (!textItem?.runs || textItem.runs.length <= 1) return;
  for (const run of textItem.runs) {
    try {
      const range = shape.getRange(run.start, run.end);
      if (!range) continue;

      // Font per run — use direct range properties (fontId first, same pattern)
      if (run.fontFamily) {
        const runFamily = run.fontFamily
          .replace(/["']/g, "")
          .split(",")[0]
          .trim();
        const runWeight = String(run.fontWeight || "400");
        const runItalic = (run.fontStyle || "")
          .toLowerCase()
          .includes("italic");
        const penpotFont = findFont(runFamily);
        if (penpotFont) {
          const targetStyle = runItalic ? "italic" : "normal";
          const variant =
            penpotFont.variants.find(
              (v) => v.fontWeight === runWeight && v.fontStyle === targetStyle,
            ) ||
            penpotFont.variants.find((v) => v.fontWeight === runWeight) ||
            penpotFont.variants[0];
          // fontId first, then weight/style — per official Penpot guidance
          range.fontId = penpotFont.fontId;
          range.fontFamily = penpotFont.fontFamily;
          if (variant) {
            range.fontVariantId = variant.fontVariantId;
            range.fontWeight = variant.fontWeight;
            range.fontStyle = variant.fontStyle || "normal";
          }
        } else {
          unresolvedFonts.add(runFamily);
          range.fontFamily = runFamily;
          range.fontWeight = runWeight;
          try {
            range.fontVariantId = toFontVariantId(
              run.fontWeight,
              run.fontStyle,
            );
          } catch (_) {}
          if (runItalic) {
            try {
              range.fontStyle = "italic";
            } catch (_) {}
          }
        }
      }

      if (run.fontSize) range.fontSize = String(run.fontSize);
      // Clamp negative letterSpacing to 0 (Penpot rejects negatives).
      if (run.letterSpacing !== undefined && run.letterSpacing !== null) {
        const rls = Math.max(0, Number(run.letterSpacing));
        try {
          range.letterSpacing = String(rls);
        } catch (_) {}
      }

      // Color per run via range.fills
      // NOTE: Penpot 2.14 RC1 has a confirmed bug where the malli schema
      // for text-range fills is nil (wrong import: app.common.types.shape
      // instead of app.common.types.fills). Fixed in Penpot commit 52a576d.
      // This will start working once Penpot is updated past that fix.
      if (run.color) {
        try {
          range.fills = [
            {
              fillColor: run.color,
              fillOpacity:
                run.colorOpacity !== undefined ? run.colorOpacity : 1,
            },
          ];
        } catch (_) {
          // Known Penpot 2.14 RC1 bug — range.fills schema is broken.
          // Base text color is still applied via shape.fills in applyTextColor.
        }
      }

      const dec = run.textDecoration || "";
      if (dec.includes("underline")) {
        try {
          range.textDecoration = "underline";
        } catch (_) {}
      } else if (dec.includes("line-through")) {
        try {
          range.textDecoration = "line-through";
        } catch (_) {}
      }
      if (run.textTransform && run.textTransform !== "none") {
        try {
          range.textTransform = run.textTransform;
        } catch (_) {}
      }
    } catch (e) {
      console.warn("[PenpotVF] applyTextRuns run failed:", e.message);
    }
  }
}

// ─── Main shape builder ───────────────────────────────────────────────────────

let totalNodes = 0;
let processedNodes = 0;
const mediaCache = new Map(); // url → MediaObject, avoid re-uploading same URL
const unresolvedFonts = new Set(); // font families not found in Penpot's registry

// UI-based timers (setTimeout doesn't reliably fire in the plugin sandbox)
const pendingTimers = new Map(); // id → resolve(null)
let _timerIdCounter = 0;

async function uploadMedia(name, url) {
  if (mediaCache.has(url)) return mediaCache.get(url);
  const isData = url.startsWith("data:");
  console.log(`[DBG] uploadMedia: ${isData ? "data:..." : url}`);
  try {
    let media;

    if (isData) {
      const comma = url.indexOf(",");
      if (comma === -1) return null;
      const header = url.slice(5, comma);
      const mimeType = header.split(";")[0] || "image/png";
      if (!header.includes(";base64")) return null;
      const binary = atob(url.slice(comma + 1));
      const uint8 = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) uint8[i] = binary.charCodeAt(i);

      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("uploadMediaData timeout")), 15000),
      );
      media = await Promise.race([
        penpot.uploadMediaData(name, uint8, mimeType),
        timeout,
      ]);
    } else {
      // setTimeout doesn't fire in the plugin sandbox, so we delegate the
      // timeout to the UI iframe (which runs in a normal browser context).
      const timerId = ++_timerIdCounter;
      const timerPromise = new Promise((resolve) => {
        pendingTimers.set(timerId, () => resolve(null));
      });
      penpot.ui.sendMessage({ type: "startTimer", id: timerId, ms: 10000 });

      const uploadPromise = penpot
        .uploadMediaUrl(name, url)
        .then((m) => {
          penpot.ui.sendMessage({ type: "cancelTimer", id: timerId });
          return m;
        })
        .catch(() => null);

      media = await Promise.race([uploadPromise, timerPromise]);
    }

    console.log(`[DBG] uploadMedia: resolved media=${!!media}`);
    if (media) mediaCache.set(url, media);
    return media;
  } catch (e) {
    console.warn(`[DBG] uploadMedia catch: ${e.message}`);
    return null;
  }
}

function countNodes(node) {
  if (!node) return 0;
  let n = 1;
  if (node.texts) n += node.texts.length;
  if (node.children) for (const c of node.children) n += countNodes(c);
  return n;
}

function appendToParent(parent, child) {
  if (!parent || !child) return;
  if (typeof parent.appendChild === "function") {
    parent.appendChild(child);
    return;
  }
  if (parent.root && typeof parent.root.appendChild === "function") {
    parent.root.appendChild(child);
    return;
  }
  throw new Error("Parent does not support appendChild");
}

async function buildShape(node, parent, offsetX, offsetY) {
  if (cancelled || !node) return null;

  processedNodes++;
  const pct = Math.round((processedNodes / totalNodes) * 98);
  penpot.ui.sendMessage({ type: "progress", value: pct });

  const kind = node.kind || "frame";
  console.log(
    `[DBG] #${processedNodes}/${totalNodes} (${pct}%) kind=${kind} name=${JSON.stringify(node.name || "")} src=${node.src ?? ""}`,
  );

  // ── SVG ──────────────────────────────────────────────────────────────────────
  if (kind === "svg") {
    if (node.svgContent) {
      console.log(
        `[DBG] SVG: calling createShapeFromSvgWithImages, svgLen=${node.svgContent.length}`,
      );
      try {
        // createShapeFromSvgWithImages is the proper async API; it handles
        // embedded images and is always awaitable. createShapeFromSvg is
        // documented as sync but may return a Promise in some Penpot versions,
        // which would silently hang without await.
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("svg timeout")), 10000),
        );
        const shape = await Promise.race([
          penpot.createShapeFromSvgWithImages(node.svgContent),
          timeout,
        ]);
        console.log(`[DBG] SVG: done, shape=${!!shape}`);
        if (shape) {
          shape.name = node.name || "SVG";
          shape.x = (node.x || 0) + offsetX;
          shape.y = (node.y || 0) + offsetY;
          if (node.w || node.h)
            shape.resize(
              Math.max(1, node.w || shape.width),
              Math.max(1, node.h || shape.height),
            );
          applyCommonStyles(shape, node);
          appendToParent(parent, shape);
          applyLayoutChildSizing(shape, node.layoutChild);
          return shape;
        }
      } catch (e) {
        console.warn(`[DBG] SVG failed: ${e.message}`);
      }
    }
    // Fallback: placeholder rect
    const rect = penpot.createRectangle();
    rect.name = node.name || "SVG";
    rect.x = (node.x || 0) + offsetX;
    rect.y = (node.y || 0) + offsetY;
    rect.resize(Math.max(1, node.w || 1), Math.max(1, node.h || 1));
    rect.fills = [{ fillColor: "#e2e2e2", fillOpacity: 1 }];
    appendToParent(parent, rect);
    return rect;
  }

  // ── Video placeholder ─────────────────────────────────────────────────────────
  if (kind === "video") {
    const w = Math.max(1, node.w || 1);
    const h = Math.max(1, node.h || 1);

    // If we got a poster/frame thumbnail from the extension, render it as image
    if (node.src) {
      console.log(`[DBG] video: uploadMedia src=${node.src}`);
      const shape = penpot.createRectangle();
      shape.name = node.name || "Video";
      shape.x = (node.x || 0) + offsetX;
      shape.y = (node.y || 0) + offsetY;
      shape.resize(w, h);
      applyCommonStyles(shape, node);
      const media = await uploadMedia(node.name || "video", node.src);
      console.log(`[DBG] video: uploadMedia done, media=${!!media}`);
      shape.fills = media
        ? [{ fillImage: media, fillOpacity: 1 }]
        : [{ fillColor: "#1a1a2e", fillOpacity: 1 }];
      appendToParent(parent, shape);
      applyLayoutChildSizing(shape, node.layoutChild);
      return shape;
    }

    // No image available — build a dark placeholder board with a "VIDEO" label
    const board = penpot.createBoard();
    board.name = node.name || "Video";
    board.x = (node.x || 0) + offsetX;
    board.y = (node.y || 0) + offsetY;
    board.resize(w, h);
    board.fills = [{ fillColor: "#1a1a2e", fillOpacity: 1 }];
    board.clipContent = true;
    appendToParent(parent, board);
    applyLayoutChildSizing(board, node.layoutChild);

    // Center "▶ VIDEO" text label
    const label = penpot.createText("▶  VIDEO");
    if (label) {
      label.name = "video-label";
      label.fontFamily = "Source Sans Pro";
      label.fontSize = String(Math.max(12, Math.round(Math.min(w, h) * 0.1)));
      label.fontWeight = "700";
      label.fills = [{ fillColor: "#ffffff", fillOpacity: 0.7 }];
      try {
        label.align = "center";
      } catch (_) {}
      label.resize(w, Math.max(24, Math.round(Math.min(w, h) * 0.15)));
      label.x = board.x;
      label.y = board.y + (h - label.height) / 2;
      board.appendChild(label);
    }

    return board;
  }

  // ── Image ────────────────────────────────────────────────────────────────────
  if (kind === "image") {
    // SVG images: Penpot cannot render SVGs as fillImage — use createShapeFromSvgWithImages instead
    const isSvgSrc =
      node.src &&
      (/\.svg(?:[?#]|$)/i.test(node.src) ||
        node.src.startsWith("data:image/svg+xml"));
    if (isSvgSrc) {
      try {
        let svgContent = node.svgContent; // may be pre-fetched by the extension
        if (!svgContent && node.src) {
          if (node.src.startsWith("data:image/svg+xml")) {
            const comma = node.src.indexOf(",");
            if (comma !== -1) {
              const header = node.src.slice(0, comma);
              if (header.includes("base64")) {
                svgContent = atob(node.src.slice(comma + 1));
              } else {
                svgContent = decodeURIComponent(node.src.slice(comma + 1));
              }
            }
          } else {
            const resp = await fetch(node.src);
            if (resp.ok) svgContent = await resp.text();
          }
        }
        if (svgContent && svgContent.includes("<svg")) {
          console.log(
            `[DBG] SVG image: calling createShapeFromSvgWithImages, svgLen=${svgContent.length}`,
          );
          const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("svg image timeout")), 10000),
          );
          const svgShape = await Promise.race([
            penpot.createShapeFromSvgWithImages(svgContent),
            timeout,
          ]);
          if (svgShape) {
            svgShape.name = node.name || "SVG";
            svgShape.x = (node.x || 0) + offsetX;
            svgShape.y = (node.y || 0) + offsetY;
            if (node.w || node.h)
              svgShape.resize(
                Math.max(1, node.w || svgShape.width),
                Math.max(1, node.h || svgShape.height),
              );
            applyCommonStyles(svgShape, node);
            appendToParent(parent, svgShape);
            applyLayoutChildSizing(svgShape, node.layoutChild);
            return svgShape;
          }
        }
      } catch (e) {
        console.warn(
          `[PenpotVF] SVG image handling failed, falling back to rect:`,
          e.message,
        );
      }
    }

    const shape = penpot.createRectangle();
    shape.name = node.name || "Image";
    shape.x = (node.x || 0) + offsetX;
    shape.y = (node.y || 0) + offsetY;
    shape.resize(Math.max(1, node.w || 1), Math.max(1, node.h || 1));
    // Apply strokes/shadows/border-radius first; fills are overridden below
    applyCommonStyles(shape, node);

    // Set image fill AFTER applyCommonStyles so it is not overwritten
    if (node.src) {
      console.log(`[DBG] image: uploadMedia src=${node.src}`);
      const media = await uploadMedia(node.name || "image", node.src);
      console.log(`[DBG] image: uploadMedia done, media=${!!media}`);
      if (media) {
        shape.fills = [{ fillImage: media, fillOpacity: 1 }];
      } else {
        shape.fills = [{ fillColor: "#c8c8c8", fillOpacity: 1 }];
      }
    } else {
      shape.fills = [{ fillColor: "#c8c8c8", fillOpacity: 1 }];
    }

    appendToParent(parent, shape);
    applyLayoutChildSizing(shape, node.layoutChild);
    return shape;
  }

  // ── Passthrough / inline-texts ───────────────────────────────────────────────
  if (kind === "passthrough" || kind === "inline-texts") {
    if (node.texts && node.texts.length === 1 && !node.children?.length) {
      const ti = node.texts[0];
      const t = buildTextShape(ti, offsetX, offsetY);
      if (t) {
        t.name = node.name || "Text";
        appendToParent(parent, t);
        applyTextFontAndColor(t, ti);
        applyLayoutChildSizing(t, node.layoutChild);
      }
      return t;
    }
    // Multiple texts or mixed: treat as group — add to parent directly
    const shapes = [];
    if (node.texts) {
      for (const ti of node.texts) {
        const t = buildTextShape(ti, offsetX, offsetY);
        if (t) {
          appendToParent(parent, t);
          applyTextFontAndColor(t, ti);
          shapes.push(t);
        }
      }
    }
    if (node.children) {
      for (const child of node.children) {
        if (cancelled) break;
        const s = await buildShape(child, parent, offsetX, offsetY);
        if (s) shapes.push(s);
      }
    }
    return shapes[0] || null;
  }

  // ── Frame ────────────────────────────────────────────────────────────────────
  const hasChildren = node.children && node.children.length > 0;
  const hasTexts = node.texts && node.texts.length > 0;
  const hasLayout = !!node.layout;

  if (!hasChildren && !hasLayout && hasTexts && node.texts.length === 1) {
    // Simple text-only leaf → text shape
    const textItem = node.texts[0];
    let t;
    try {
      t = buildTextShape(
        textItem,
        offsetX + (node.x || 0),
        offsetY + (node.y || 0),
      );
    } catch (e) {
      console.error(
        "[PenpotVF] buildTextShape threw for",
        node.name,
        e.message,
      );
      return null;
    }
    if (t) {
      try {
        t.name = node.name || "Text";
      } catch (e) {
        console.warn("[PenpotVF] t.name threw:", e.message);
      }
      try {
        t.resize(
          Math.max(1, node.w || t.width),
          Math.max(1, node.h || t.height),
        );
      } catch (e) {
        console.warn("[PenpotVF] t.resize threw:", e.message);
      }
      try {
        applyCommonStyles(t, node);
      } catch (e) {
        console.warn("[PenpotVF] applyCommonStyles threw:", e.message);
      }
      try {
        appendToParent(parent, t);
      } catch (e) {
        console.warn("[PenpotVF] appendToParent threw:", e.message);
      }
      applyTextFontAndColor(t, textItem);
      try {
        applyLayoutChildSizing(t, node.layoutChild);
      } catch (e) {
        console.warn("[PenpotVF] applyLayoutChildSizing threw:", e.message);
      }
    }
    return t;
  }

  // Container frame or leaf rectangle
  const isLeaf = !hasChildren && !hasTexts && !hasLayout;
  const frame = isLeaf ? penpot.createRectangle() : penpot.createBoard();
  if (!frame) {
    console.error(
      "[PenpotVF] createBoard/createRectangle returned null for:",
      node.name,
    );
    return null;
  }
  frame.name = node.name || (isLeaf ? "Rectangle" : "Frame");
  frame.x = (node.x || 0) + offsetX;
  frame.y = (node.y || 0) + offsetY;
  frame.resize(Math.max(1, node.w || 1), Math.max(1, node.h || 1));
  if (!isLeaf) frame.clipContent = node.clipContent || false;

  applyCommonStyles(frame, node);

  // Boards/rectangles are white by default in Penpot. If the captured element
  // had no fill (transparent background), clear the default white fill.
  if (!node.fills || !node.fills.length) {
    try {
      frame.fills = [];
    } catch (_) {}
  }

  // Apply imgFills (CSS background-image URLs)
  if (node.imgFills && node.imgFills.length) {
    for (const fill of node.imgFills) {
      const url = typeof fill === "string" ? fill : fill?.url;
      if (!url || (!url.startsWith("http://") && !url.startsWith("https://")))
        continue;
      const media = await uploadMedia(url, url);
      if (media) {
        frame.fills = [
          { fillImage: media, fillOpacity: 1 },
          ...(frame.fills || []),
        ];
      }
    }
  }

  // Layout (skipped when user checks "Skip flex/grid layout")
  if (hasLayout && !buildOptions.skipLayout) {
    if (node.layout.type === "flex") {
      applyFlexLayout(frame, node.layout);
    } else if (node.layout.type === "grid") {
      applyGridLayout(frame, node.layout);
    }
  }

  appendToParent(parent, frame);

  // Apply layout child sizing NOW (after append, so layoutChild proxy exists)
  if (!buildOptions.skipLayout) {
    applyLayoutChildSizing(frame, node.layoutChild);

    // Grid child placement
    if (node.layoutChild) {
      applyGridChildPlacement(frame, node.layoutChild);
    }
  }

  // Add text shapes inside this frame (positioned relative to the frame's page position)
  if (hasTexts) {
    for (const ti of node.texts) {
      if (cancelled) break;
      processedNodes++;
      let t;
      try {
        t = buildTextShape(ti, frame.x, frame.y);
      } catch (e) {
        console.warn("[PenpotVF] buildTextShape in frame threw:", e.message);
      }
      if (t) {
        try {
          t.name = (ti.content || "").trim().slice(0, 40) || "Text";
          frame.appendChild(t);
          applyTextFontAndColor(t, ti);
        } catch (e) {
          console.warn("[PenpotVF] frame text append/color threw:", e.message);
        }
      }
    }
  }

  // Recurse into children
  if (hasChildren) {
    for (const child of node.children) {
      if (cancelled) break;
      try {
        await buildShape(child, frame, frame.x, frame.y);
      } catch (e) {
        console.error("[PenpotVF] child build failed for", child?.name, e);
      }
    }
  }

  return frame;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

let buildOptions = {};

async function buildFromCapture(capture, options) {
  if (!capture?.tree) {
    penpot.ui.sendMessage({ type: "error", message: "Invalid capture data." });
    return;
  }

  buildOptions = options || {};
  cancelled = false;
  totalNodes = countNodes(capture.tree);
  processedNodes = 0;
  mediaCache.clear();
  unresolvedFonts.clear();
  penpot.ui.sendMessage({ type: "progress", value: 0 });

  const page = penpot.currentPage;
  if (!page) {
    penpot.ui.sendMessage({ type: "error", message: "No active page." });
    return;
  }

  try {
    const root = capture.tree;

    // Place below existing content, with a 32px gap.
    // If the page is empty, land at (100, 100).
    const GAP = 32;
    const MARGIN_X = 100;
    const MARGIN_Y = 100;
    let landingY = MARGIN_Y;
    try {
      const shapes = page.findShapes();
      if (shapes && shapes.length > 0) {
        const maxBottom = shapes.reduce((acc, s) => {
          const bottom = (s.y || 0) + (s.height || 0);
          return bottom > acc ? bottom : acc;
        }, 0);
        if (maxBottom > 0) landingY = maxBottom + GAP;
      }
    } catch (_) {}
    const offsetX = MARGIN_X - (root.x || 0);
    const offsetY = landingY - (root.y || 0);

    // Build the root shape inside the page root container
    const rootParent = page.root || page;
    const rootShape = await buildShape(root, rootParent, offsetX, offsetY);

    if (!rootShape) {
      penpot.ui.sendMessage({
        type: "error",
        message: "Could not build any shapes.",
      });
      return;
    }

    penpot.ui.sendMessage({ type: "progress", value: 100 });

    const missingFonts = [...unresolvedFonts];
    penpot.ui.sendMessage({ type: "done", missingFonts });
  } catch (err) {
    penpot.ui.sendMessage({
      type: "error",
      message: err.message || String(err),
    });
  }
}

// ─── Message handler ─────────────────────────────────────────────────────────

penpot.ui.onMessage((msg) => {
  // UI signals it's ready — reply with the current theme so timing issues are avoided
  if (msg.type === "ready") {
    penpot.ui.sendMessage({ type: "theme", content: penpot.theme });
  }
  if (msg.type === "build") buildFromCapture(msg.capture, msg.options);
  if (msg.type === "cancel") {
    cancelled = true;
    penpot.ui.sendMessage({ type: "cancelled" });
  }
  if (msg.type === "timerFired") {
    const cb = pendingTimers.get(msg.id);
    if (cb) {
      pendingTimers.delete(msg.id);
      console.warn(`[DBG] uploadMedia TIMEOUT id=${msg.id}`);
      cb();
    }
  }
  if (msg.type === "check-fonts") {
    const missing = [];
    for (const name of msg.fonts || []) {
      if (!findFont(name)) missing.push(name);
    }
    penpot.ui.sendMessage({ type: "fonts-checked", missing });
  }
});
