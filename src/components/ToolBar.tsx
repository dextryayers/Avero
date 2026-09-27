import { useMemo, useState } from "react";
import {
  Brush,
  Circle,
  CircleDashed,
  Crop,
  Eraser,
  Hand,
  Hexagon,
  Lasso,
  Layers,
  MousePointer2,
  Move,
  Pipette,
  Square,
  Stamp,
  Droplet,
  Type,
  Wand2,
  ZoomIn,
  Bandage,
  Droplets,
  Sun,
  Moon,
  Waves,
  PaintBucket,
  PenTool,
  Minus,
  Focus,
  Zap,
  Ruler,
  StickyNote,
  Hash,
  PenLine,
  Pencil,
  Paintbrush,
  Sparkles,
  Scan,
  EyeOff,
  RotateCcw,
  Frame,
  LayoutDashboard,
  Scissors,
  Copy,
  Wand,
  Triangle,
  MousePointer,
  Blend,
  StretchHorizontal,
  SprayCan,
  Star,
  ArrowRight,
  Palette,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
} from "lucide-react";
import { useEditorStore, type ToolId } from "../stores/useEditorStore";
import clsx from "clsx";

export interface ToolDef {
  id: ToolId;
  icon: any;
  label: string;
  shortcut: string;
  description: string;
  usage: string;
}

export interface ToolFamily {
  id: string;
  label: string;
  icon: any;
  shortcut: string;
  description: string;
  tools: ToolDef[];
}

// Single source of truth. No visual duplicates: each family shows ONE button
// in the slim bar. Variants live in flyout + expandable sidebar with descriptions.
export const TOOL_FAMILIES: ToolFamily[] = [
  {
    id: "move",
    label: "Move",
    icon: Move,
    shortcut: "V",
    description: "Move layers and transform selection.",
    tools: [
      { id: "move", icon: Move, label: "Move Tool", shortcut: "V", description: "Move active layer. Shift snaps to guides.", usage: "Drag layer. Shift = snap. Ctrl+T = free transform." },
      { id: "artboard", icon: LayoutDashboard, label: "Artboard Tool", shortcut: "V", description: "Create and arrange artboards for multi-canvas work.", usage: "Drag to create an artboard." },
      { id: "path-select", icon: MousePointer, label: "Path Selection", shortcut: "A", description: "Select a whole vector path.", usage: "Click a path to select it." },
      { id: "direct-select", icon: MousePointer2, label: "Direct Selection", shortcut: "A", description: "Edit individual anchor points.", usage: "Click an anchor to edit." },
    ],
  },
  {
    id: "select",
    label: "Select",
    icon: MousePointer2,
    shortcut: "M",
    description: "Marquee selections plus grow and shrink utilities.",
    tools: [
      { id: "select-rect", icon: MousePointer2, label: "Rectangular Marquee", shortcut: "M", description: "Rectangular selection. Shift adds, Alt subtracts.", usage: "Drag to select. Feather in Select panel." },
      { id: "select-ellipse", icon: CircleDashed, label: "Elliptical Marquee", shortcut: "M", description: "Elliptical selection for round areas.", usage: "Drag to select. Shift = circle." },
      { id: "single-row", icon: Minus, label: "Single Row Marquee", shortcut: "M", description: "Select a single 1px horizontal row.", usage: "Click a row to select it." },
      { id: "single-column", icon: Minus, label: "Single Column Marquee", shortcut: "M", description: "Select a single 1px vertical column.", usage: "Click a column to select it." },
      { id: "select-rounded", icon: Square, label: "Rounded Marquee", shortcut: "Y", description: "Rectangle with soft rounded corners.", usage: "Drag to select." },
      { id: "select-grow", icon: Scan, label: "Grow Selection", shortcut: "Y", description: "Expand current selection 4px.", usage: "Click to grow." },
      { id: "select-shrink", icon: Scan, label: "Shrink Selection", shortcut: "Y", description: "Contract current selection 4px.", usage: "Click to shrink." },
    ],
  },
  {
    id: "lasso",
    label: "Lasso",
    icon: Lasso,
    shortcut: "L",
    description: "Freehand, polygonal, wand and AI-assisted selections.",
    tools: [
      { id: "select-lasso", icon: Lasso, label: "Lasso", shortcut: "L", description: "Freehand selection. Close path to finish.", usage: "Drag freely, release near start." },
      { id: "select-polygon", icon: Hexagon, label: "Polygonal Lasso", shortcut: "L", description: "Straight-edge polygon selection.", usage: "Click points, double-click to close." },
      { id: "magnetic-lasso", icon: Lasso, label: "Magnetic Lasso", shortcut: "Y", description: "Freehand with edge snap + expand.", usage: "Drag around edges." },
      { id: "object-select", icon: Scan, label: "Object Select", shortcut: "W", description: "Auto rectangular object detection.", usage: "Drag around an object." },
      { id: "quick-select", icon: Wand, label: "Quick Select", shortcut: "W", description: "Brush-based auto selection.", usage: "Paint over the subject." },
      { id: "wand", icon: Wand2, label: "Magic Wand", shortcut: "W", description: "Select similar colors by tolerance.", usage: "Click an area. Tolerance in Select panel." },
      { id: "wand-plus", icon: Wand2, label: "Wand Grow", shortcut: "Y", description: "Wand then auto-grow 2px.", usage: "Click to select larger." },
      { id: "wand-minus", icon: Wand2, label: "Wand Shrink", shortcut: "Y", description: "Wand then auto-shrink 2px.", usage: "Click for tighter select." },
      { id: "color-range", icon: Palette, label: "Color Range", shortcut: "W", description: "Select every pixel similar to the clicked color.", usage: "Click a color. Tolerance in options bar." },
      { id: "select-subject", icon: Focus, label: "Select Subject", shortcut: "W", description: "One-click auto subject selection.", usage: "Click anywhere on the subject." },
      { id: "ai-subject", icon: Focus, label: "AI Subject", shortcut: "0", description: "Center-weighted subject select.", usage: "Click to select subject." },
      { id: "ai-bg-remove", icon: EyeOff, label: "BG Remove", shortcut: "0", description: "Select subject + mask background.", usage: "Click subject." },
    ],
  },
  {
    id: "crop",
    label: "Crop",
    icon: Crop,
    shortcut: "C",
    description: "Crop presets, slice, frame and upscale.",
    tools: [
      { id: "crop", icon: Crop, label: "Crop", shortcut: "C", description: "Crop document. Enter applies, Esc cancels.", usage: "Drag area, Enter to apply." },
      { id: "perspective-crop", icon: Crop, label: "Perspective Crop", shortcut: "C", description: "Crop with perspective correction.", usage: "Drag area, adjust corners." },
      { id: "crop-169", icon: Crop, label: "Crop 16:9", shortcut: "A", description: "Widescreen crop locked 16:9.", usage: "Drag, ratio locked." },
      { id: "crop-43", icon: Crop, label: "Crop 4:3", shortcut: "A", description: "Classic photo ratio 4:3.", usage: "Drag, ratio locked." },
      { id: "crop-11", icon: Square, label: "Crop 1:1", shortcut: "A", description: "Square crop for avatars.", usage: "Drag square." },
      { id: "crop-32", icon: Crop, label: "Crop 3:2", shortcut: "A", description: "Full-frame 3:2 ratio.", usage: "Drag, ratio locked." },
      { id: "crop-free", icon: Crop, label: "Crop Free", shortcut: "A", description: "Free crop, no lock.", usage: "Drag freely." },
      { id: "crop-straighten", icon: Ruler, label: "Straighten", shortcut: "A", description: "Crop + auto-level horizon.", usage: "Drag horizon line." },
      { id: "slice", icon: Scissors, label: "Slice", shortcut: "C", description: "Cut export slices.", usage: "Drag to define a slice." },
      { id: "slice-select", icon: Copy, label: "Slice Select", shortcut: "C", description: "Select and move slices.", usage: "Click a slice." },
      { id: "frame", icon: Frame, label: "Frame", shortcut: "K", description: "Placeholder frame for images.", usage: "Drag to create a frame." },
      { id: "ai-upscale", icon: ArrowRight, label: "Upscale 2x", shortcut: "0", description: "Double document with smooth upscale.", usage: "Click to upscale." },
    ],
  },
  {
    id: "measure",
    label: "Measure",
    icon: Pipette,
    shortcut: "I",
    description: "Sample color, measure, angle, area and annotate.",
    tools: [
      { id: "eyedropper", icon: Pipette, label: "Eyedropper", shortcut: "I", description: "Pick a color from canvas.", usage: "Click canvas to sample." },
      { id: "color-sampler", icon: Pipette, label: "Color Sampler", shortcut: "I", description: "Persistent color readout point.", usage: "Click to place a sampler." },
      { id: "sampler-avg", icon: Pipette, label: "Average Sampler", shortcut: "5", description: "5x5 average color pin.", usage: "Click to pin average." },
      { id: "ruler", icon: Ruler, label: "Ruler", shortcut: "I", description: "Measure distance and angle.", usage: "Drag to measure." },
      { id: "measure-angle", icon: Ruler, label: "Angle", shortcut: "5", description: "Measure angle from horizontal.", usage: "Drag to measure angle." },
      { id: "measure-area", icon: Square, label: "Area", shortcut: "5", description: "Drag rect for W x H + area.", usage: "Drag rectangle." },
      { id: "snap-toggle", icon: Zap, label: "Snap Toggle", shortcut: "5", description: "Toggle snapping on/off.", usage: "Click to toggle." },
      { id: "note", icon: StickyNote, label: "Note", shortcut: "I", description: "Attach a note to canvas.", usage: "Click to add a note." },
      { id: "count", icon: Hash, label: "Count", shortcut: "I", description: "Count objects with numbered markers.", usage: "Click to add a count." },
    ],
  },
  {
    id: "brush",
    label: "Brush",
    icon: Brush,
    shortcut: "B",
    description: "Paint, sketch and art engines, 23 variants.",
    tools: [
      { id: "brush", icon: Brush, label: "Brush", shortcut: "B", description: "Soft round brush with smoothing.", usage: "Paint freely. [ ] = size." },
      { id: "pencil", icon: Pencil, label: "Pencil", shortcut: "B", description: "Hard 1px edge, no anti-alias.", usage: "Pixel-precise strokes." },
      { id: "airbrush", icon: SprayCan, label: "Airbrush", shortcut: "B", description: "Soft spray buildup, low flow per dab.", usage: "Hold to build up tone." },
      { id: "soft-brush", icon: Paintbrush, label: "Soft Brush", shortcut: "B", description: "Extra-large feather for blending.", usage: "Blend and soften." },
      { id: "color-replacement", icon: Pipette, label: "Color Replacement", shortcut: "B", description: "Replace hue while keeping luminance.", usage: "Paint over target color." },
      { id: "mixer-brush", icon: Paintbrush, label: "Mixer Brush", shortcut: "B", description: "Wet oil-paint color mixing.", usage: "Paint to mix wet colors." },
      { id: "overlay-brush", icon: Blend, label: "Overlay Brush", shortcut: "B", description: "Paint contrast and light with overlay blend.", usage: "Paint for soft light contrast." },
      { id: "sketch-charcoal", icon: Pencil, label: "Charcoal", shortcut: "N", description: "Grainy dark charcoal with texture.", usage: "Sketch with rough grain." },
      { id: "sketch-pastel", icon: Paintbrush, label: "Pastel", shortcut: "N", description: "Soft chalky pastel, low opacity buildup.", usage: "Soft shading strokes." },
      { id: "sketch-marker", icon: PenLine, label: "Marker", shortcut: "N", description: "Flat saturated marker, hard edge.", usage: "Bold flat strokes." },
      { id: "sketch-highlighter", icon: PaintBucket, label: "Highlighter", shortcut: "N", description: "Translucent highlight glaze.", usage: "Glaze over areas." },
      { id: "sketch-ink", icon: PenTool, label: "Ink Pen", shortcut: "N", description: "Crisp ink line, full opacity.", usage: "Crisp line work." },
      { id: "sketch-felt", icon: Pencil, label: "Felt Tip", shortcut: "N", description: "Soft felt tip, medium bleed.", usage: "Sketch lines." },
      { id: "sketch-neon", icon: Zap, label: "Neon", shortcut: "N", description: "Additive glow stroke for light effects.", usage: "Paint glowing lines." },
      { id: "sketch-chalk", icon: SprayCan, label: "Chalk", shortcut: "N", description: "Dusty chalk with scatter.", usage: "Dusty strokes." },
      { id: "art-oil", icon: Paintbrush, label: "Oil Brush", shortcut: "F", description: "Thick oil paint with wet mixing.", usage: "Paint thick oils." },
      { id: "art-watercolor", icon: Droplets, label: "Watercolor", shortcut: "F", description: "Translucent watercolor wash.", usage: "Wash lightly." },
      { id: "art-knife", icon: Scissors, label: "Palette Knife", shortcut: "F", description: "Flat knife scrape with hard edge.", usage: "Scrape flat color." },
      { id: "art-smear", icon: Waves, label: "Finger Smear", shortcut: "F", description: "Smear pixels like a finger.", usage: "Drag to smear." },
      { id: "art-glaze", icon: Droplet, label: "Glaze", shortcut: "F", description: "Thin transparent color glaze.", usage: "Glaze thin color." },
      { id: "art-impasto", icon: Layers, label: "Impasto", shortcut: "F", description: "Heavy impasto with contrast punch.", usage: "Heavy strokes." },
      { id: "art-canvas", icon: LayoutDashboard, label: "Canvas Texture", shortcut: "F", description: "Weave texture tinted with brush color.", usage: "Stamp texture." },
      { id: "art-poster", icon: Star, label: "Poster Brush", shortcut: "F", description: "Graphic posterize blend stroke.", usage: "Graphic strokes." },
    ],
  },
  {
    id: "eraser",
    label: "Eraser",
    icon: Eraser,
    shortcut: "E",
    description: "Erase with three different modes.",
    tools: [
      { id: "eraser", icon: Eraser, label: "Eraser", shortcut: "E", description: "Soft standard eraser. Paints mask when mask mode is on.", usage: "Drag to erase." },
      { id: "background-eraser", icon: Eraser, label: "Background Eraser", shortcut: "E", description: "Erases only colors similar to sampled edge.", usage: "Drag along background edge." },
      { id: "magic-eraser", icon: Sparkles, label: "Magic Eraser", shortcut: "E", description: "One-click flood erase of flat areas.", usage: "Click a flat area." },
      { id: "eraser-hard", icon: Eraser, label: "Hard Eraser", shortcut: "E", description: "100% hard block eraser for pixel work.", usage: "Drag for hard erase." },
    ],
  },
  {
    id: "heal",
    label: "Heal",
    icon: Bandage,
    shortcut: "J",
    description: "Remove spots, heal, retouch skin and fill content.",
    tools: [
      { id: "spot-heal", icon: Bandage, label: "Spot Healing", shortcut: "J", description: "Auto-blend spots with surroundings.", usage: "Click or paint over blemishes." },
      { id: "healing-brush", icon: Sparkles, label: "Healing Brush", shortcut: "J", description: "Alt-click source, precise healing.", usage: "Alt-click source, then paint." },
      { id: "patch", icon: Layers, label: "Patch", shortcut: "J", description: "Drag source area onto target.", usage: "Drag source to target." },
      { id: "content-move", icon: StretchHorizontal, label: "Content-Aware Move", shortcut: "J", description: "Move object, background auto-fills.", usage: "Drag an object." },
      { id: "content-fill", icon: Sparkles, label: "Content Fill", shortcut: "J", description: "Fill selection with surrounding texture.", usage: "Select area, click to fill." },
      { id: "red-eye", icon: EyeOff, label: "Red Eye", shortcut: "J", description: "One-click red-eye correction.", usage: "Click red eyes." },
      { id: "heal-dust", icon: Sparkles, label: "Dust Remove", shortcut: "8", description: "Tiny spot heal for dust.", usage: "Click dust spots." },
      { id: "heal-wrinkle", icon: Waves, label: "Wrinkle Soften", shortcut: "8", description: "Gentle soften for skin lines.", usage: "Paint wrinkles." },
      { id: "heal-blemish", icon: Bandage, label: "Blemish Pro", shortcut: "8", description: "Stronger blemish blend.", usage: "Paint blemishes." },
      { id: "heal-sky", icon: Droplets, label: "Sky Clean", shortcut: "8", description: "Wide soft clean for sky.", usage: "Paint sky spots." },
      { id: "heal-skin", icon: Droplet, label: "Skin Smooth", shortcut: "8", description: "Edge-safe skin smooth.", usage: "Paint skin." },
      { id: "heal-object", icon: EyeOff, label: "Object Erase", shortcut: "8", description: "Content fill erase for objects.", usage: "Paint object." },
    ],
  },
  {
    id: "stamp",
    label: "Stamp",
    icon: Stamp,
    shortcut: "S",
    description: "Clone, mirror, pattern and history painting.",
    tools: [
      { id: "clone", icon: Stamp, label: "Clone Stamp", shortcut: "S", description: "Alt-click source, paint exact copies.", usage: "Alt-click source, then paint." },
      { id: "clone-mirror", icon: Copy, label: "Mirror Clone", shortcut: "7", description: "Alt source, mirrored copy.", usage: "Alt-click, paint mirrored." },
      { id: "clone-rotate", icon: RotateCcw, label: "Rotate Clone", shortcut: "7", description: "Alt source, 90deg rotated copy.", usage: "Alt-click, paint rotated." },
      { id: "pattern-stamp", icon: Stamp, label: "Pattern Stamp", shortcut: "S", description: "Paint with active pattern.", usage: "Paint with pattern." },
      { id: "pattern-fill", icon: PaintBucket, label: "Pattern Fill", shortcut: "7", description: "Click to fill layer with pattern.", usage: "Click to fill." },
      { id: "texture-stamp", icon: SprayCan, label: "Texture Stamp", shortcut: "7", description: "Grain weave stamp.", usage: "Paint texture." },
      { id: "history-brush", icon: RotateCcw, label: "History Brush", shortcut: "Y", description: "Restore from history snapshot.", usage: "Paint to restore." },
      { id: "art-history-brush", icon: Paintbrush, label: "Art History Brush", shortcut: "Y", description: "Artistic stylized history strokes.", usage: "Paint for artistic effect." },
    ],
  },
  {
    id: "tone",
    label: "Tone",
    icon: Sun,
    shortcut: "O",
    description: "Dodge, burn, light grading and AI color.",
    tools: [
      { id: "dodge", icon: Sun, label: "Dodge", shortcut: "O", description: "Lighten locally with soft buildup.", usage: "Paint to lighten." },
      { id: "burn", icon: Moon, label: "Burn", shortcut: "O", description: "Darken locally with soft buildup.", usage: "Paint to darken." },
      { id: "sponge", icon: Focus, label: "Sponge", shortcut: "O", description: "Local saturation control.", usage: "Paint to saturate / desaturate." },
      { id: "vibrance-brush", icon: Palette, label: "Vibrance Brush", shortcut: "O", description: "Smart saturation protecting skin tones.", usage: "Paint to boost muted colors." },
      { id: "light-highlights", icon: Sun, label: "Highlights", shortcut: "K", description: "Lift only bright tones.", usage: "Paint over highlights." },
      { id: "light-shadows", icon: Moon, label: "Shadows", shortcut: "K", description: "Open only dark tones.", usage: "Paint over shadows." },
      { id: "light-temp", icon: Sun, label: "Temperature", shortcut: "K", description: "Warm/cool local white balance.", usage: "Paint to warm." },
      { id: "light-tint", icon: Droplet, label: "Tint", shortcut: "K", description: "Green-magenta local tint.", usage: "Paint to tint." },
      { id: "light-clarity", icon: Zap, label: "Clarity", shortcut: "K", description: "Midtone local contrast.", usage: "Paint for clarity." },
      { id: "light-dehaze", icon: Waves, label: "Dehaze", shortcut: "K", description: "Cut haze, deepen blacks.", usage: "Paint to dehaze." },
      { id: "light-saturate", icon: Palette, label: "Saturate", shortcut: "K", description: "Boost local saturation.", usage: "Paint to saturate." },
      { id: "light-levels", icon: Layers, label: "Levels Brush", shortcut: "K", description: "Stretch local levels.", usage: "Paint to expand tone." },
      { id: "ai-colorize", icon: Palette, label: "AI Color", shortcut: "0", description: "Add Vibrance + Color Lookup.", usage: "Click to colorize." },
      { id: "ai-sky", icon: Droplets, label: "Sky Enhance", shortcut: "0", description: "Cool + contrast sky preset.", usage: "Click to enhance." },
    ],
  },
  {
    id: "detail",
    label: "Detail",
    icon: Droplets,
    shortcut: "R",
    description: "Blur, sharpen, smudge, distort and AI denoise.",
    tools: [
      { id: "blur", icon: Droplets, label: "Blur", shortcut: "R", description: "Soften with radius-based blur.", usage: "Paint to soften." },
      { id: "blur-iris", icon: Focus, label: "Iris Blur", shortcut: "R", description: "Strong center-falloff blur.", usage: "Paint for depth of field." },
      { id: "sharpen", icon: Zap, label: "Sharpen", shortcut: "R", description: "Local contrast sharpening.", usage: "Paint to sharpen detail." },
      { id: "sharpen-edge", icon: Zap, label: "Edge Sharpen", shortcut: "R", description: "Sharpen edges only, protects flat areas.", usage: "Paint over edges." },
      { id: "smudge", icon: Waves, label: "Smudge", shortcut: "R", description: "Drag pixels like wet paint.", usage: "Click to pick color, drag." },
      { id: "noise-reduction", icon: Waves, label: "Noise Reduction", shortcut: "R", description: "Smooth luminance noise preserving edges.", usage: "Paint over noisy areas." },
      { id: "liquify", icon: Waves, label: "Liquify", shortcut: "O", description: "Push pixels with distortion.", usage: "Drag to distort." },
      { id: "warp", icon: Blend, label: "Warp", shortcut: "O", description: "Grid-based flexible warp.", usage: "Drag grid to bend." },
      { id: "distort-twirl", icon: RotateCcw, label: "Twirl CW", shortcut: "D", description: "Rotate pixels clockwise around dab.", usage: "Hold and paint to twirl." },
      { id: "distort-twirl-ccw", icon: RotateCcw, label: "Twirl CCW", shortcut: "D", description: "Rotate pixels counter-clockwise.", usage: "Paint to twirl back." },
      { id: "distort-pinch", icon: Focus, label: "Pinch", shortcut: "D", description: "Pull pixels toward dab center.", usage: "Paint to pinch." },
      { id: "distort-ripple", icon: Waves, label: "Ripple", shortcut: "D", description: "Sine ripple displacement.", usage: "Paint for waves." },
      { id: "distort-wave", icon: Waves, label: "Wave", shortcut: "D", description: "Horizontal wave shift.", usage: "Paint for wave." },
      { id: "distort-zigzag", icon: Zap, label: "Zigzag", shortcut: "D", description: "Sharp zigzag offset.", usage: "Paint for zigzag." },
      { id: "distort-spherize", icon: Circle, label: "Spherize", shortcut: "D", description: "Spherical bulge magnify.", usage: "Paint to bulge." },
      { id: "distort-crystal", icon: Hexagon, label: "Crystalize", shortcut: "D", description: "Faceted mosaic crystal blocks.", usage: "Paint to crystalize." },
      { id: "detail-grain-remove", icon: Waves, label: "Grain Remove", shortcut: "X", description: "Smooth grain preserving edges.", usage: "Paint over grain." },
      { id: "detail-sharpen-more", icon: Zap, label: "Sharpen More", shortcut: "X", description: "Stronger edge sharpen.", usage: "Paint to sharpen hard." },
      { id: "detail-blur-more", icon: Droplets, label: "Blur More", shortcut: "X", description: "Extra strong soften.", usage: "Paint to soften hard." },
      { id: "detail-tilt", icon: Focus, label: "Tilt-Shift Brush", shortcut: "X", description: "Miniature tilt blur falloff.", usage: "Paint for miniature." },
      { id: "detail-lens", icon: Circle, label: "Lens Blur", shortcut: "X", description: "Creamy circular lens blur.", usage: "Paint for bokeh." },
      { id: "detail-motion", icon: ArrowRight, label: "Motion Brush", shortcut: "X", description: "Directional motion streak.", usage: "Paint for motion." },
      { id: "ai-denoise", icon: Waves, label: "AI Denoise", shortcut: "0", description: "Add Reduce-Noise filter.", usage: "Click to denoise." },
    ],
  },
  {
    id: "paint",
    label: "Paint",
    icon: Droplet,
    shortcut: "G",
    description: "Gradient and fill tools.",
    tools: [
      { id: "gradient", icon: Droplet, label: "Linear Gradient", shortcut: "G", description: "Linear blend between foreground and target.", usage: "Drag to define direction." },
      { id: "gradient-radial", icon: Circle, label: "Radial Gradient", shortcut: "G", description: "Circular falloff gradient.", usage: "Drag from center outward." },
      { id: "fill", icon: PaintBucket, label: "Paint Bucket", shortcut: "G", description: "Tolerance flood fill respecting selection.", usage: "Click area to fill." },
    ],
  },
  {
    id: "vector",
    label: "Vector",
    icon: PenTool,
    shortcut: "P",
    description: "Pen paths and lines.",
    tools: [
      { id: "pen", icon: PenTool, label: "Pen", shortcut: "P", description: "Free bezier path.", usage: "Drag for free path." },
      { id: "curvature-pen", icon: PenLine, label: "Curvature Pen", shortcut: "P", description: "Click curve points with handles.", usage: "Click points, drag handles." },
      { id: "line", icon: Minus, label: "Line", shortcut: "P", description: "Straight line. Shift locks 45 degrees.", usage: "Drag for straight line." },
    ],
  },
  {
    id: "type",
    label: "Type",
    icon: Type,
    shortcut: "T",
    description: "Horizontal, vertical and FX text.",
    tools: [
      { id: "text", icon: Type, label: "Horizontal Type", shortcut: "T", description: "Click canvas to type horizontally.", usage: "Click, then type." },
      { id: "text-vertical", icon: Type, label: "Vertical Type", shortcut: "T", description: "Vertical CJK-style text flow.", usage: "Click, then type vertically." },
      { id: "text-outline", icon: Type, label: "Outline Type", shortcut: "9", description: "Hollow outline text layer.", usage: "Click, then type." },
      { id: "text-glow", icon: Sparkles, label: "Glow Type", shortcut: "9", description: "Soft glow text layer.", usage: "Click, then type." },
      { id: "text-shadow", icon: Copy, label: "Shadow Type", shortcut: "9", description: "Hard drop-shadow text.", usage: "Click, then type." },
      { id: "text-arc", icon: RotateCcw, label: "Arc Type", shortcut: "9", description: "Arched banner text.", usage: "Click, then type." },
    ],
  },
  {
    id: "shape",
    label: "Shape",
    icon: Square,
    shortcut: "U",
    description: "Vector shapes with full controls, 14 variants.",
    tools: [
      { id: "shape-rect", icon: Square, label: "Rectangle", shortcut: "U", description: "Rectangle. Shift = square.", usage: "Drag to draw." },
      { id: "shape-ellipse", icon: Circle, label: "Ellipse", shortcut: "U", description: "Oval. Shift = circle.", usage: "Drag to draw." },
      { id: "triangle-shape", icon: Triangle, label: "Triangle", shortcut: "U", description: "Three-point triangle.", usage: "Drag to draw." },
      { id: "shape-polygon", icon: Hexagon, label: "Polygon", shortcut: "U", description: "Multi-side polygon.", usage: "Drag to draw." },
      { id: "shape-line", icon: Minus, label: "Shape Line", shortcut: "U", description: "Vector line shape.", usage: "Drag to draw." },
      { id: "shape-star", icon: Star, label: "Star", shortcut: "U", description: "5-point vector star.", usage: "Drag to draw." },
      { id: "shape-arrow", icon: ArrowRight, label: "Arrow", shortcut: "U", description: "Block arrow shape.", usage: "Drag to draw." },
      { id: "shape-custom", icon: Sparkles, label: "Custom Shape", shortcut: "U", description: "Decorative custom shape.", usage: "Drag to draw." },
      { id: "shape-rounded", icon: Square, label: "Rounded Rect", shortcut: "W", description: "Rectangle with round corners.", usage: "Drag to draw." },
      { id: "shape-diamond", icon: Hexagon, label: "Diamond", shortcut: "W", description: "Four-point diamond.", usage: "Drag to draw." },
      { id: "shape-heart", icon: Circle, label: "Heart", shortcut: "W", description: "Bezier heart shape.", usage: "Drag to draw." },
      { id: "shape-hexagon", icon: Hexagon, label: "Hexagon", shortcut: "W", description: "Six-side hexagon.", usage: "Drag to draw." },
      { id: "shape-burst", icon: Star, label: "Burst", shortcut: "W", description: "12-spike starburst seal.", usage: "Drag to draw." },
      { id: "shape-donut", icon: Circle, label: "Donut", shortcut: "W", description: "Ring with transparent hole.", usage: "Drag to draw." },
    ],
  },
  {
    id: "navigate",
    label: "Navigate",
    icon: Hand,
    shortcut: "H",
    description: "Pan, rotate, zoom and one-click zoom presets.",
    tools: [
      { id: "hand", icon: Hand, label: "Hand", shortcut: "H", description: "Pan canvas. Scroll zooms.", usage: "Drag to pan." },
      { id: "pan", icon: Hand, label: "Pan (Alt)", shortcut: "H", description: "Alternate pan for stylus.", usage: "Drag to pan." },
      { id: "rotate-view", icon: RotateCcw, label: "Rotate View", shortcut: "R", description: "Non-destructive view rotation.", usage: "Drag to rotate view." },
      { id: "zoom", icon: ZoomIn, label: "Zoom", shortcut: "Z", description: "Click zoom in, Alt-click zoom out.", usage: "Click / Alt-click." },
      { id: "zoom-fit", icon: Scan, label: "Fit Screen", shortcut: "6", description: "Fit document to screen.", usage: "Click canvas to fit." },
      { id: "zoom-100", icon: ZoomIn, label: "100%", shortcut: "6", description: "Actual pixels.", usage: "Click for 100%." },
      { id: "zoom-200", icon: ZoomIn, label: "200%", shortcut: "6", description: "Double detail.", usage: "Click for 200%." },
      { id: "zoom-400", icon: ZoomIn, label: "400%", shortcut: "6", description: "Pixel inspection.", usage: "Click for 400%." },
    ],
  },
  {
    id: "localfx",
    label: "Local FX",
    icon: Sparkles,
    shortcut: "Q",
    description: "Twelve local adjustment brushes with soft falloff.",
    tools: [
      { id: "exposure-brush", icon: Sun, label: "Exposure Brush", shortcut: "Q", description: "Lift local exposure with soft falloff.", usage: "Paint to brighten." },
      { id: "warmth-brush", icon: Sun, label: "Warmth Brush", shortcut: "Q", description: "Warm local color, cool shadows stay.", usage: "Paint to warm." },
      { id: "fade-brush", icon: Droplets, label: "Fade Brush", shortcut: "Q", description: "Soft matte fade toward mid gray.", usage: "Paint to fade." },
      { id: "contrast-brush", icon: Zap, label: "Contrast Brush", shortcut: "Q", description: "Local contrast around midtones.", usage: "Paint for punch." },
      { id: "posterize-brush", icon: Layers, label: "Posterize Brush", shortcut: "Q", description: "Four level posterize blend.", usage: "Paint for graphic tone." },
      { id: "threshold-brush", icon: Circle, label: "Threshold Brush", shortcut: "Q", description: "Local black and white snap.", usage: "Paint for graphic ink." },
      { id: "hue-brush", icon: Palette, label: "Hue Brush", shortcut: "Q", description: "Rotate local hue gently.", usage: "Paint to shift hue." },
      { id: "invert-brush", icon: EyeOff, label: "Invert Brush", shortcut: "Q", description: "Local invert blend for drama.", usage: "Paint to invert." },
      { id: "desat-brush", icon: Droplet, label: "Desaturate Brush", shortcut: "Q", description: "Pull local saturation out.", usage: "Paint to mute color." },
      { id: "grain-brush", icon: SprayCan, label: "Grain Brush", shortcut: "Q", description: "Add fine deterministic film grain.", usage: "Paint for texture." },
      { id: "pixelate-brush", icon: LayoutDashboard, label: "Pixelate Brush", shortcut: "Q", description: "Local mosaic for privacy or style.", usage: "Paint to pixelate." },
      { id: "vignette-brush", icon: Focus, label: "Vignette Brush", shortcut: "Q", description: "Darken dab edges like a lens.", usage: "Paint to vignette." },
    ],
  },
];

export const TOOL_LABEL: Record<string, string> = Object.fromEntries(
  TOOL_FAMILIES.flatMap((f) => f.tools.map((t) => [t.id, t.label])),
);

export const TOOLS = TOOL_FAMILIES.flatMap((f) =>
  f.tools.map((t) => ({ id: t.id, icon: t.icon, label: t.label, shortcut: t.shortcut, group: f.label })),
);

export const TOOL_MAP: Record<string, ToolDef> = Object.fromEntries(
  TOOL_FAMILIES.flatMap((f) => f.tools.map((t) => [t.id, t])),
);

export const FAMILY_OF: Record<string, string> = Object.fromEntries(
  TOOL_FAMILIES.flatMap((f) => f.tools.map((t) => [t.id, f.id])),
);

export default function ToolBar() {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [openFamily, setOpenFamily] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TOOL_FAMILIES;
    return TOOL_FAMILIES.map((f) => ({
      ...f,
      tools: f.tools.filter(
        (t) =>
          t.label.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.id.includes(q),
      ),
    })).filter((f) => f.tools.length > 0);
  }, [query]);

  function pickFamily(f: ToolFamily) {
    if (openFamily === f.id) {
      // second click cycles variants
      const idx = f.tools.findIndex((t) => t.id === tool);
      const next = f.tools[(idx + 1) % f.tools.length];
      setTool(next.id);
    } else {
      setOpenFamily(f.id);
      if (!f.tools.some((t) => t.id === tool)) setTool(f.tools[0].id);
    }
  }

  return (
    <div className="flex shrink-0">
      {/* Slim icon bar - one button per family, no duplicates */}
      <div className="flex w-[56px] flex-col items-center gap-0.5 overflow-y-auto border-r border-[#2c2c31] bg-[#1c1c1f] py-2">
        {TOOL_FAMILIES.map((f) => {
          const Icon = f.icon;
          const active = FAMILY_OF[tool] === f.id;
          const variantCount = f.tools.length;
          const activeVariant = active ? (TOOL_MAP[tool]?.label ?? f.tools[0].label) : f.tools[0].label;
          return (
            <button
              key={f.id}
              title={`${f.label} (${f.shortcut}) - ${variantCount} sub-tools. Active: ${activeVariant}. ${f.description} Click again to cycle variants.`}
              onClick={() => pickFamily(f)}
              onContextMenu={(e) => {
                e.preventDefault();
                setOpenFamily(openFamily === f.id ? null : f.id);
                setExpanded(true);
              }}
              className={clsx(
                "relative grid h-9 w-9 shrink-0 place-items-center rounded-md border",
                active ? "border-[#2f7cf6] bg-[#2f7cf6] text-white" : "border-transparent text-[#a7a7b0] hover:bg-[#232327] hover:text-white",
              )}
            >
              <Icon size={16} strokeWidth={1.9} />
              <span className="pointer-events-none absolute left-[4px] top-[3px] font-mono text-[7.5px] font-semibold leading-none opacity-50">
                {f.shortcut}
              </span>
              {variantCount > 1 && (
                <span className="absolute bottom-[3px] right-[3px] h-1 w-1 rounded-full bg-current opacity-60" />
              )}
            </button>
          );
        })}
        <button
          title={expanded ? "Collapse tool panel" : "Expand tool panel with descriptions"}
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 grid h-8 w-9 place-items-center rounded-md text-[#a7a7b0] hover:bg-[#232327] hover:text-white"
        >
          {expanded ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
        </button>
        <div className="mt-auto px-1 pb-1 text-center font-mono text-[8.5px] leading-tight text-[#6e6e78]">
          Ctrl+K
        </div>
      </div>

      {/* Expandable sidebar with descriptions, search, collapsible groups */}
      {expanded && (
        <div className="flex w-[264px] flex-col border-r border-[#2c2c31] bg-[#161618]">
          <div className="flex items-center gap-2 border-b border-[#2c2c31] p-2">
            <Search size={13} className="shrink-0 text-[#6e6e78]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tools..."
              className="w-full bg-transparent text-[12px] text-white outline-none placeholder:text-[#6e6e78]"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {filtered.map((f) => {
              const isCollapsed = !!collapsed[f.id];
              const isActiveFamily = FAMILY_OF[tool] === f.id;
              return (
                <div key={f.id} className="mb-1.5 rounded-md border border-[#2c2c31] bg-[#1c1c1f]">
                  <button
                    onClick={() => setCollapsed((s) => ({ ...s, [f.id]: !s[f.id] }))}
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-left"
                  >
                    <f.icon size={14} className={isActiveFamily ? "text-white" : "text-[#a7a7b0]"} />
                    <span className="flex-1 text-[12px] font-semibold text-white">{f.label}</span>
                    <span className="rounded border border-[#2c2c31] bg-[#101012] px-1 py-px font-mono text-[9px] text-[#a7a7b0]">{f.shortcut}</span>
                    <ChevronDown
                      size={13}
                      className={clsx("text-[#6e6e78] transition-transform", isCollapsed && "-rotate-90")}
                    />
                  </button>
                  {!isCollapsed && (
                    <div className="px-1.5 pb-1.5">
                      <div className="mb-1.5 px-1 text-[10.5px] leading-snug text-[#6e6e78]">{f.description}</div>
                      {f.tools.map((t) => {
                        const Icon = t.icon;
                        const active = tool === t.id;
                        return (
                          <button
                            key={t.id}
                            onClick={() => setTool(t.id)}
                            title={`${t.label} (${t.shortcut}) - ${t.usage}`}
                            className={clsx(
                              "mb-1 w-full rounded-md border px-2 py-1.5 text-left",
                              active
                                ? "border-[#2f7cf6] bg-[#232327]"
                                : "border-transparent hover:border-[#2c2c31] hover:bg-[#232327]",
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <Icon size={14} className={active ? "text-white" : "text-[#a7a7b0]"} />
                              <span className={clsx("flex-1 text-[12px] font-medium", active ? "text-white" : "text-[#c9c9d1]")}>
                                {t.label}
                              </span>
                              <span className="font-mono text-[9px] text-[#6e6e78]">{t.shortcut}</span>
                            </div>
                            <div className="mt-0.5 pl-6 text-[11px] leading-snug text-[#6e6e78]">{t.description}</div>
                            <div className="mt-0.5 pl-6 text-[10px] italic leading-snug text-[#4a4a52]">{t.usage}</div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="p-3 text-center text-[12px] text-[#6e6e78]">No tools match “{query}”.</div>
            )}
          </div>
          <div className="border-t border-[#2c2c31] p-2 text-[10px] leading-snug text-[#6e6e78]">
            17 families, 174 sub-tools. Click a family icon to select. Click again to cycle variants. Right-click opens this panel.
          </div>
        </div>
      )}

      {/* Flyout for current family when sidebar closed */}
      {!expanded && openFamily && (
        <div className="w-[220px] border-r border-[#2c2c31] bg-[#161618] p-1.5">
          {(() => {
            const f = TOOL_FAMILIES.find((x) => x.id === openFamily);
            if (!f) return null;
            return (
              <div>
                <div className="mb-1 flex items-center gap-1.5 px-1 pt-1">
                  <span className="text-[11px] font-semibold text-white">{f.label}</span>
                  <span className="rounded border border-[#2c2c31] bg-[#101012] px-1 py-px font-mono text-[9px] text-[#a7a7b0]">{f.shortcut}</span>
                  <span className="rounded bg-[#2f7cf6] px-1 py-px font-mono text-[9px] text-white">{f.tools.length}</span>
                </div>
                <div className="mb-2 px-1 text-[10.5px] text-[#6e6e78]">{f.description}</div>
                {f.tools.map((t) => {
                  const Icon = t.icon;
                  const active = tool === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTool(t.id)}
                      className={clsx(
                        "mb-1 w-full rounded-md px-2 py-1.5 text-left",
                        active ? "bg-[#2f7cf6] text-white" : "text-[#c9c9d1] hover:bg-[#232327]",
                      )}
                      title={`${t.label} (${t.shortcut}) - ${t.usage}`}
                    >
                      <div className="flex items-center gap-2 text-[12px]">
                        <Icon size={14} />
                        <span className="flex-1">{t.label}</span>
                        <span className={clsx("font-mono text-[9px]", active ? "text-white/70" : "text-[#6e6e78]")}>{t.shortcut}</span>
                      </div>
                      <div className={clsx("mt-0.5 text-[10px]", active ? "text-white/70" : "text-[#6e6e78]")}>
                        {t.description}
                      </div>
                      <div className={clsx("mt-0.5 text-[10px] italic", active ? "text-white/60" : "text-[#4a4a52]")}>
                        {t.usage}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
