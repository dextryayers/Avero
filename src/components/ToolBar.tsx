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
  Plus,
  Magnet,
  Cloud,
  Mountain,
  Crosshair,
  Monitor,
  Camera,
  Smartphone,
  RectangleHorizontal,
  RectangleVertical,
  MapPin,
  DraftingCompass,
  Expand,
  Shrink,
  SeparatorVertical,
  Squircle,
  WandSparkles,
  Rotate3d,
  FlaskConical,
  Contrast,
  Highlighter,
  Pen,
  Sparkle,
  PaintRoller,
  Hammer,
  Beaker,
  Wind,
  Feather,
  GlassWater,
  Ghost,
  Box,
  CloudFog,
  Syringe,
  Dot,
  Smile,
  Trash2,
  Eye,
  CircleDot,
  LayoutGrid,
  LayoutTemplate,
  FlipHorizontal2,
  Grip,
  History,
  Sunrise,
  Sunset,
  Thermometer,
  Rainbow,
  SunDim,
  MoonStar,
  Aperture,
  ScanLine,
  Gem,
  Fingerprint,
  SlidersHorizontal,
  Grab,
  RotateCw,
  Minimize2,
  Spline,
  MoveHorizontal,
  Activity,
  Globe,
  Diamond,
  ChevronsUp,
  ChevronsDown,
  Building2,
  Disc,
  FastForward,
  ShieldCheck,
  Navigation,
  Award,
  ChevronsRight,
  Cross,
  Heart,
  Donut,
  Shapes,
  MoveVertical,
  SquareDashed,
  ZoomOut,
  Maximize,
  Microscope,
  Telescope,
  Compass,
  Coffee,
  Film,
  Split,
  Lightbulb,
  Flame,
  TrendingDown,
  ToggleLeft,
  RefreshCw,
  Clapperboard,
  Eclipse,
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
      { id: "move-auto", icon: Scan, label: "Auto Select Layer", shortcut: "V", description: "Click photo to auto-pick top layer with pixels.", usage: "Click a visible object to select its layer, then drag." },
      { id: "transform-free", icon: StretchHorizontal, label: "Free Transform", shortcut: "V", description: "Move with transform handles ready.", usage: "Drag to move. Fine scale/rotate in Transform panel." },
      { id: "align-center", icon: Focus, label: "Align Center", shortcut: "V", description: "One click centers active layer to canvas.", usage: "Click canvas to center layer." },
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
      { id: "single-column", icon: SeparatorVertical, label: "Single Column Marquee", shortcut: "M", description: "Select a single 1px vertical column.", usage: "Click a column to select it." },
      { id: "select-rounded", icon: Squircle, label: "Rounded Marquee", shortcut: "Y", description: "Rectangle with soft rounded corners.", usage: "Drag to select." },
      { id: "select-grow", icon: Expand, label: "Grow Selection", shortcut: "Y", description: "Expand current selection 4px.", usage: "Click to grow." },
      { id: "select-shrink", icon: Shrink, label: "Shrink Selection", shortcut: "Y", description: "Contract current selection 4px.", usage: "Click to shrink." },
      { id: "select-square", icon: Square, label: "Square Marquee", shortcut: "M", description: "Square-locked marquee for icons and avatars.", usage: "Drag to select a square." },
      { id: "select-feather", icon: Sparkles, label: "Feather Select", shortcut: "M", description: "Soften current selection edge 6px.", usage: "Click to feather. Needs a selection first." },
      { id: "select-border", icon: CircleDashed, label: "Border Smooth", shortcut: "M", description: "Smooth and tighten selection border.", usage: "Click to smooth border." },
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
      { id: "magnetic-lasso", icon: Magnet, label: "Magnetic Lasso", shortcut: "Y", description: "Freehand with edge snap + expand.", usage: "Drag around edges." },
      { id: "object-select", icon: Scan, label: "Object Select", shortcut: "W", description: "Auto rectangular object detection.", usage: "Drag around an object." },
      { id: "quick-select", icon: Sparkles, label: "Quick Select", shortcut: "W", description: "Brush-based auto selection.", usage: "Paint over the subject." },
      { id: "wand", icon: Wand2, label: "Magic Wand", shortcut: "W", description: "Select similar colors by tolerance.", usage: "Click an area. Tolerance in Select panel." },
      { id: "wand-plus", icon: WandSparkles, label: "Wand Grow", shortcut: "Y", description: "Wand then auto-grow 2px.", usage: "Click to select larger." },
      { id: "wand-minus", icon: Wand, label: "Wand Shrink", shortcut: "Y", description: "Wand then auto-shrink 2px.", usage: "Click for tighter select." },
      { id: "color-range", icon: Palette, label: "Color Range", shortcut: "W", description: "Select every pixel similar to the clicked color.", usage: "Click a color. Tolerance in options bar." },
      { id: "select-subject", icon: Crosshair, label: "Select Subject", shortcut: "W", description: "One-click auto subject selection.", usage: "Click anywhere on the subject." },
      { id: "sky-select", icon: Cloud, label: "Sky Select", shortcut: "W", description: "Manual sky band select top 62 percent.", usage: "Click to select sky area." },
      { id: "background-select", icon: Mountain, label: "Background Select", shortcut: "W", description: "Manual background pick from corners.", usage: "Click to select background tone." },
      { id: "focus-select", icon: Focus, label: "Focus Select", shortcut: "W", description: "Center ellipse focus area with feather.", usage: "Click to select center focus." },
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
      { id: "perspective-crop", icon: Rotate3d, label: "Perspective Crop", shortcut: "C", description: "Crop with perspective correction.", usage: "Drag area, adjust corners." },
      { id: "crop-169", icon: Monitor, label: "Crop 16:9", shortcut: "A", description: "Widescreen crop locked 16:9.", usage: "Drag, ratio locked." },
      { id: "crop-43", icon: RectangleHorizontal, label: "Crop 4:3", shortcut: "A", description: "Classic photo ratio 4:3.", usage: "Drag, ratio locked." },
      { id: "crop-11", icon: Square, label: "Crop 1:1", shortcut: "A", description: "Square crop for avatars.", usage: "Drag square." },
      { id: "crop-32", icon: Camera, label: "Crop 3:2", shortcut: "A", description: "Full-frame 3:2 ratio.", usage: "Drag, ratio locked." },
      { id: "crop-free", icon: Crop, label: "Crop Free", shortcut: "A", description: "Free crop, no lock.", usage: "Drag freely." },
      { id: "crop-straighten", icon: Ruler, label: "Straighten", shortcut: "A", description: "Crop + auto-level horizon.", usage: "Drag horizon line." },
      { id: "slice", icon: Scissors, label: "Slice", shortcut: "C", description: "Cut export slices.", usage: "Drag to define a slice." },
      { id: "slice-select", icon: Copy, label: "Slice Select", shortcut: "C", description: "Select and move slices.", usage: "Click a slice." },
      { id: "frame", icon: Frame, label: "Frame", shortcut: "K", description: "Placeholder frame for images.", usage: "Drag to create a frame." },
      { id: "crop-219", icon: StretchHorizontal, label: "Crop 21:9", shortcut: "A", description: "Ultrawide cinematic 21:9.", usage: "Drag, ratio locked." },
      { id: "crop-45", icon: RectangleVertical, label: "Crop 4:5", shortcut: "A", description: "Portrait social 4:5.", usage: "Drag, ratio locked." },
      { id: "crop-916", icon: Smartphone, label: "Crop 9:16", shortcut: "A", description: "Vertical story 9:16.", usage: "Drag, ratio locked." },
      { id: "crop-golden", icon: Sparkles, label: "Crop Golden", shortcut: "A", description: "Golden ratio 1.618 premium crop.", usage: "Drag, ratio locked." },
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
      { id: "color-sampler", icon: MapPin, label: "Color Sampler", shortcut: "I", description: "Persistent color readout point.", usage: "Click to place a sampler." },
      { id: "sampler-avg", icon: Droplet, label: "Average Sampler", shortcut: "5", description: "5x5 average color pin.", usage: "Click to pin average." },
      { id: "ruler", icon: Ruler, label: "Ruler", shortcut: "I", description: "Measure distance and angle.", usage: "Drag to measure." },
      { id: "measure-angle", icon: Triangle, label: "Angle", shortcut: "5", description: "Measure angle from horizontal.", usage: "Drag to measure angle." },
      { id: "measure-area", icon: Square, label: "Area", shortcut: "5", description: "Drag rect for W x H + area.", usage: "Drag rectangle." },
      { id: "snap-toggle", icon: Zap, label: "Snap Toggle", shortcut: "5", description: "Toggle snapping on/off.", usage: "Click to toggle." },
      { id: "note", icon: StickyNote, label: "Note", shortcut: "I", description: "Attach a note to canvas.", usage: "Click to add a note." },
      { id: "count", icon: Hash, label: "Count", shortcut: "I", description: "Count objects with numbered markers.", usage: "Click to add a count." },
      { id: "protractor", icon: DraftingCompass, label: "Protractor", shortcut: "I", description: "Manual angle measure with label.", usage: "Drag to measure angle." },
      { id: "guide-clear", icon: EyeOff, label: "Clear Guides", shortcut: "I", description: "One click removes all guides.", usage: "Click canvas to clear guides." },
      { id: "grid-toggle", icon: LayoutDashboard, label: "Grid Toggle", shortcut: "I", description: "One click toggles Photoshop grid.", usage: "Click canvas to toggle grid." },
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
      { id: "mixer-brush", icon: FlaskConical, label: "Mixer Brush", shortcut: "B", description: "Wet oil-paint color mixing.", usage: "Paint to mix wet colors." },
      { id: "overlay-brush", icon: Blend, label: "Overlay Brush", shortcut: "B", description: "Paint contrast and light with overlay blend.", usage: "Paint for soft light contrast." },
      { id: "sketch-charcoal", icon: Contrast, label: "Charcoal", shortcut: "N", description: "Grainy dark charcoal with texture.", usage: "Sketch with rough grain." },
      { id: "sketch-pastel", icon: Cloud, label: "Pastel", shortcut: "N", description: "Soft chalky pastel, low opacity buildup.", usage: "Soft shading strokes." },
      { id: "sketch-marker", icon: PenLine, label: "Marker", shortcut: "N", description: "Flat saturated marker, hard edge.", usage: "Bold flat strokes." },
      { id: "sketch-highlighter", icon: Highlighter, label: "Highlighter", shortcut: "N", description: "Translucent highlight glaze.", usage: "Glaze over areas." },
      { id: "sketch-ink", icon: PenTool, label: "Ink Pen", shortcut: "N", description: "Crisp ink line, full opacity.", usage: "Crisp line work." },
      { id: "sketch-felt", icon: Pen, label: "Felt Tip", shortcut: "N", description: "Soft felt tip, medium bleed.", usage: "Sketch lines." },
      { id: "sketch-neon", icon: Zap, label: "Neon", shortcut: "N", description: "Additive glow stroke for light effects.", usage: "Paint glowing lines." },
      { id: "sketch-chalk", icon: Sparkle, label: "Chalk", shortcut: "N", description: "Dusty chalk with scatter.", usage: "Dusty strokes." },
      { id: "art-oil", icon: PaintRoller, label: "Oil Brush", shortcut: "F", description: "Thick oil paint with wet mixing.", usage: "Paint thick oils." },
      { id: "art-watercolor", icon: Droplets, label: "Watercolor", shortcut: "F", description: "Translucent watercolor wash.", usage: "Wash lightly." },
      { id: "art-knife", icon: Scissors, label: "Palette Knife", shortcut: "F", description: "Flat knife scrape with hard edge.", usage: "Scrape flat color." },
      { id: "art-smear", icon: Waves, label: "Finger Smear", shortcut: "F", description: "Smear pixels like a finger.", usage: "Drag to smear." },
      { id: "art-glaze", icon: GlassWater, label: "Glaze", shortcut: "F", description: "Thin transparent color glaze.", usage: "Glaze thin color." },
      { id: "art-impasto", icon: Hammer, label: "Impasto", shortcut: "F", description: "Heavy impasto with contrast punch.", usage: "Heavy strokes." },
      { id: "art-canvas", icon: LayoutDashboard, label: "Canvas Texture", shortcut: "F", description: "Weave texture tinted with brush color.", usage: "Stamp texture." },
      { id: "art-poster", icon: Star, label: "Poster Brush", shortcut: "F", description: "Graphic posterize blend stroke.", usage: "Graphic strokes." },
      { id: "brush-dry", icon: Brush, label: "Dry Brush", shortcut: "B", description: "Manual dry bristle with scatter.", usage: "Paint textured dry strokes." },
      { id: "brush-wet", icon: Beaker, label: "Wet Blend", shortcut: "B", description: "Manual wet mix canvas plus brush color.", usage: "Paint to blend wet." },
      { id: "brush-glitter", icon: Sparkles, label: "Glitter", shortcut: "B", description: "Manual sparkle scatter additive.", usage: "Paint sparkles." },
      { id: "brush-smoke", icon: Wind, label: "Smoke", shortcut: "B", description: "Manual soft smoke wash extra large.", usage: "Wash soft smoke." },
      { id: "brush-fur", icon: Feather, label: "Fur", shortcut: "N", description: "Manual fibrous multiply scatter.", usage: "Paint fur texture." },
      { id: "brush-inkwash", icon: Droplet, label: "Ink Wash", shortcut: "N", description: "Manual east-ink wash multiply glaze.", usage: "Wash ink tones." },
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
      { id: "background-eraser", icon: Ghost, label: "Background Eraser", shortcut: "E", description: "Erases only colors similar to sampled edge.", usage: "Drag along background edge." },
      { id: "magic-eraser", icon: Sparkles, label: "Magic Eraser", shortcut: "E", description: "One-click flood erase of flat areas.", usage: "Click a flat area." },
      { id: "eraser-hard", icon: Box, label: "Hard Eraser", shortcut: "E", description: "100% hard block eraser for pixel work.", usage: "Drag for hard erase." },
      { id: "eraser-soft", icon: CloudFog, label: "Soft Eraser", shortcut: "E", description: "Manual extra-soft zero-hardness erase.", usage: "Drag for soft erase." },
      { id: "eraser-block", icon: Square, label: "Block Eraser", shortcut: "E", description: "Manual pixel-block hard erase.", usage: "Drag for block erase." },
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
      { id: "healing-brush", icon: Syringe, label: "Healing Brush", shortcut: "J", description: "Alt-click source, precise healing.", usage: "Alt-click source, then paint." },
      { id: "patch", icon: Layers, label: "Patch", shortcut: "J", description: "Drag source area onto target.", usage: "Drag source to target." },
      { id: "content-move", icon: StretchHorizontal, label: "Content-Aware Move", shortcut: "J", description: "Move object, background auto-fills.", usage: "Drag an object." },
      { id: "content-fill", icon: LayoutGrid, label: "Content Fill", shortcut: "J", description: "Fill selection with surrounding texture.", usage: "Select area, click to fill." },
      { id: "red-eye", icon: EyeOff, label: "Red Eye", shortcut: "J", description: "One-click red-eye correction.", usage: "Click red eyes." },
      { id: "heal-dust", icon: Sparkles, label: "Dust Remove", shortcut: "8", description: "Tiny spot heal for dust.", usage: "Click dust spots." },
      { id: "heal-wrinkle", icon: Waves, label: "Wrinkle Soften", shortcut: "8", description: "Gentle soften for skin lines.", usage: "Paint wrinkles." },
      { id: "heal-blemish", icon: CircleDot, label: "Blemish Pro", shortcut: "8", description: "Stronger blemish blend.", usage: "Paint blemishes." },
      { id: "heal-sky", icon: Droplets, label: "Sky Clean", shortcut: "8", description: "Wide soft clean for sky.", usage: "Paint sky spots." },
      { id: "heal-skin", icon: Droplet, label: "Skin Smooth", shortcut: "8", description: "Edge-safe skin smooth.", usage: "Paint skin." },
      { id: "heal-object", icon: Trash2, label: "Object Erase", shortcut: "8", description: "Content fill erase for objects.", usage: "Paint object." },
      { id: "heal-freckle", icon: Dot, label: "Freckle Clean", shortcut: "J", description: "Manual tiny freckle and dust clean.", usage: "Click freckles." },
      { id: "heal-eye", icon: Eye, label: "Eye Bag Soften", shortcut: "J", description: "Manual gentle under-eye soften.", usage: "Paint eye bags." },
      { id: "heal-teeth", icon: Smile, label: "Teeth Whiten", shortcut: "J", description: "Manual edge-safe whiten smooth.", usage: "Paint teeth." },
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
      { id: "clone-mirror", icon: FlipHorizontal2, label: "Mirror Clone", shortcut: "7", description: "Alt source, mirrored copy.", usage: "Alt-click, paint mirrored." },
      { id: "clone-rotate", icon: RotateCcw, label: "Rotate Clone", shortcut: "7", description: "Alt source, 90deg rotated copy.", usage: "Alt-click, paint rotated." },
      { id: "pattern-stamp", icon: LayoutTemplate, label: "Pattern Stamp", shortcut: "S", description: "Paint with active pattern.", usage: "Paint with pattern." },
      { id: "pattern-fill", icon: PaintBucket, label: "Pattern Fill", shortcut: "7", description: "Click to fill layer with pattern.", usage: "Click to fill." },
      { id: "texture-stamp", icon: SprayCan, label: "Texture Stamp", shortcut: "7", description: "Grain weave stamp.", usage: "Paint texture." },
      { id: "history-brush", icon: History, label: "History Brush", shortcut: "Y", description: "Restore from history snapshot.", usage: "Paint to restore." },
      { id: "art-history-brush", icon: Paintbrush, label: "Art History Brush", shortcut: "Y", description: "Artistic stylized history strokes.", usage: "Paint for artistic effect." },
      { id: "clone-soft", icon: Stamp, label: "Soft Clone", shortcut: "S", description: "Manual soft 60 percent clone.", usage: "Alt-click source, paint soft." },
      { id: "pattern-dots", icon: Grip, label: "Dots Pattern", shortcut: "S", description: "Manual dots pattern stamp.", usage: "Paint dots pattern." },
    ],
  },
  {
    id: "tone",
    label: "Tone",
    icon: Sun,
    shortcut: "O",
    description: "Dodge, burn, light grading and manual color.",
    tools: [
      { id: "dodge", icon: Sun, label: "Dodge", shortcut: "O", description: "Lighten locally with soft buildup.", usage: "Paint to lighten." },
      { id: "burn", icon: Moon, label: "Burn", shortcut: "O", description: "Darken locally with soft buildup.", usage: "Paint to darken." },
      { id: "sponge", icon: Focus, label: "Sponge", shortcut: "O", description: "Local saturation control.", usage: "Paint to saturate / desaturate." },
      { id: "vibrance-brush", icon: Palette, label: "Vibrance Brush", shortcut: "O", description: "Smart saturation protecting skin tones.", usage: "Paint to boost muted colors." },
      { id: "light-highlights", icon: Sunrise, label: "Highlights", shortcut: "K", description: "Lift only bright tones.", usage: "Paint over highlights." },
      { id: "light-shadows", icon: Sunset, label: "Shadows", shortcut: "K", description: "Open only dark tones.", usage: "Paint over shadows." },
      { id: "light-temp", icon: Thermometer, label: "Temperature", shortcut: "K", description: "Warm/cool local white balance.", usage: "Paint to warm." },
      { id: "light-tint", icon: Droplet, label: "Tint", shortcut: "K", description: "Green-magenta local tint.", usage: "Paint to tint." },
      { id: "light-clarity", icon: Zap, label: "Clarity", shortcut: "K", description: "Midtone local contrast.", usage: "Paint for clarity." },
      { id: "light-dehaze", icon: Waves, label: "Dehaze", shortcut: "K", description: "Cut haze, deepen blacks.", usage: "Paint to dehaze." },
      { id: "light-saturate", icon: Rainbow, label: "Saturate", shortcut: "K", description: "Boost local saturation.", usage: "Paint to saturate." },
      { id: "light-levels", icon: Layers, label: "Levels Brush", shortcut: "K", description: "Stretch local levels.", usage: "Paint to expand tone." },
      { id: "dodge-high", icon: SunDim, label: "Dodge Highlights", shortcut: "O", description: "Manual lighten bright tones only.", usage: "Paint highlights." },
      { id: "burn-shadow", icon: MoonStar, label: "Burn Shadows", shortcut: "O", description: "Manual darken deep tones only.", usage: "Paint shadows." },
      { id: "sponge-sat", icon: Plus, label: "Sponge Saturate", shortcut: "O", description: "Manual local saturate boost.", usage: "Paint to saturate." },
      { id: "sponge-desat", icon: Minus, label: "Sponge Desaturate", shortcut: "O", description: "Manual local muted wash.", usage: "Paint to desaturate." },
    ],
  },
  {
    id: "detail",
    label: "Detail",
    icon: Droplets,
    shortcut: "R",
    description: "Blur, sharpen, smudge, distort and denoise.",
    tools: [
      { id: "blur", icon: Droplets, label: "Blur", shortcut: "R", description: "Soften with radius-based blur.", usage: "Paint to soften." },
      { id: "blur-iris", icon: Aperture, label: "Iris Blur", shortcut: "R", description: "Strong center-falloff blur.", usage: "Paint for depth of field." },
      { id: "sharpen", icon: Zap, label: "Sharpen", shortcut: "R", description: "Local contrast sharpening.", usage: "Paint to sharpen detail." },
      { id: "sharpen-edge", icon: ScanLine, label: "Edge Sharpen", shortcut: "R", description: "Sharpen edges only, protects flat areas.", usage: "Paint over edges." },
      { id: "smudge", icon: Fingerprint, label: "Smudge", shortcut: "R", description: "Drag pixels like wet paint.", usage: "Click to pick color, drag." },
      { id: "noise-reduction", icon: SlidersHorizontal, label: "Noise Reduction", shortcut: "R", description: "Smooth luminance noise preserving edges.", usage: "Paint over noisy areas." },
      { id: "liquify", icon: Grab, label: "Liquify", shortcut: "O", description: "Push pixels with distortion.", usage: "Drag to distort." },
      { id: "warp", icon: Blend, label: "Warp", shortcut: "O", description: "Grid-based flexible warp.", usage: "Drag grid to bend." },
      { id: "distort-twirl", icon: RotateCw, label: "Twirl CW", shortcut: "D", description: "Rotate pixels clockwise around dab.", usage: "Hold and paint to twirl." },
      { id: "distort-twirl-ccw", icon: RotateCcw, label: "Twirl CCW", shortcut: "D", description: "Rotate pixels counter-clockwise.", usage: "Paint to twirl back." },
      { id: "distort-pinch", icon: Minimize2, label: "Pinch", shortcut: "D", description: "Pull pixels toward dab center.", usage: "Paint to pinch." },
      { id: "distort-ripple", icon: Spline, label: "Ripple", shortcut: "D", description: "Sine ripple displacement.", usage: "Paint for waves." },
      { id: "distort-wave", icon: MoveHorizontal, label: "Wave", shortcut: "D", description: "Horizontal wave shift.", usage: "Paint for wave." },
      { id: "distort-zigzag", icon: Activity, label: "Zigzag", shortcut: "D", description: "Sharp zigzag offset.", usage: "Paint for zigzag." },
      { id: "distort-spherize", icon: Globe, label: "Spherize", shortcut: "D", description: "Spherical bulge magnify.", usage: "Paint to bulge." },
      { id: "distort-crystal", icon: Diamond, label: "Crystalize", shortcut: "D", description: "Faceted mosaic crystal blocks.", usage: "Paint to crystalize." },
      { id: "detail-grain-remove", icon: Waves, label: "Grain Remove", shortcut: "X", description: "Smooth grain preserving edges.", usage: "Paint over grain." },
      { id: "detail-sharpen-more", icon: ChevronsUp, label: "Sharpen More", shortcut: "X", description: "Stronger edge sharpen.", usage: "Paint to sharpen hard." },
      { id: "detail-blur-more", icon: ChevronsDown, label: "Blur More", shortcut: "X", description: "Extra strong soften.", usage: "Paint to soften hard." },
      { id: "detail-tilt", icon: Building2, label: "Tilt-Shift Brush", shortcut: "X", description: "Miniature tilt blur falloff.", usage: "Paint for miniature." },
      { id: "detail-lens", icon: Disc, label: "Lens Blur", shortcut: "X", description: "Creamy circular lens blur.", usage: "Paint for bokeh." },
      { id: "detail-motion", icon: FastForward, label: "Motion Brush", shortcut: "X", description: "Directional motion streak.", usage: "Paint for motion." },
      { id: "blur-surface", icon: Droplet, label: "Surface Blur", shortcut: "R", description: "Manual flat-area smooth keep edges.", usage: "Paint flat areas." },
      { id: "blur-field", icon: Focus, label: "Field Blur", shortcut: "R", description: "Manual creamy field falloff blur.", usage: "Paint background." },
      { id: "sharpen-clarity", icon: Gem, label: "Clarity Sharp", shortcut: "R", description: "Manual midtone clarity sharpen.", usage: "Paint midtones." },
      { id: "denoise-strong", icon: ShieldCheck, label: "Denoise Strong", shortcut: "X", description: "Manual strong grain remove.", usage: "Paint noisy areas." },
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
      { id: "fill-solid", icon: PaintBucket, label: "Solid Fill", shortcut: "G", description: "Manual fill whole layer solid.", usage: "Click to fill solid." },
      { id: "fill-clear", icon: Eraser, label: "Clear Fill", shortcut: "G", description: "Manual clear layer to transparent.", usage: "Click to clear." },
      { id: "gradient-diamond", icon: Diamond, label: "Diamond Gradient", shortcut: "G", description: "Manual diagonal diamond gradient.", usage: "Click for diagonal blend." },
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
      { id: "pen-free", icon: Pencil, label: "Freeform Pen", shortcut: "P", description: "Manual freehand thin ink line.", usage: "Drag freehand line." },
      { id: "line-arrow", icon: ArrowRight, label: "Arrow Line", shortcut: "P", description: "Manual line with arrow head.", usage: "Drag for arrow line." },
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
      { id: "text-vertical", icon: MoveVertical, label: "Vertical Type", shortcut: "T", description: "Vertical CJK-style text flow.", usage: "Click, then type vertically." },
      { id: "text-outline", icon: SquareDashed, label: "Outline Type", shortcut: "9", description: "Hollow outline text layer.", usage: "Click, then type." },
      { id: "text-glow", icon: Sparkles, label: "Glow Type", shortcut: "9", description: "Soft glow text layer.", usage: "Click, then type." },
      { id: "text-shadow", icon: Copy, label: "Shadow Type", shortcut: "9", description: "Hard drop-shadow text.", usage: "Click, then type." },
      { id: "text-arc", icon: RotateCcw, label: "Arc Type", shortcut: "9", description: "Arched banner text.", usage: "Click, then type." },
      { id: "text-3d", icon: Layers, label: "3D Type", shortcut: "T", description: "Manual extruded 3D stack text.", usage: "Click, then type." },
      { id: "text-neon", icon: Zap, label: "Neon Type", shortcut: "T", description: "Manual neon tube glow text.", usage: "Click, then type." },
      { id: "text-gradient", icon: Droplet, label: "Gradient Type", shortcut: "T", description: "Manual diagonal gradient fill text.", usage: "Click, then type." },
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
      { id: "triangle-shape", icon: Navigation, label: "Triangle", shortcut: "U", description: "Three-point triangle.", usage: "Drag to draw." },
      { id: "shape-polygon", icon: Shapes, label: "Polygon", shortcut: "U", description: "Multi-side polygon.", usage: "Drag to draw." },
      { id: "shape-line", icon: Minus, label: "Shape Line", shortcut: "U", description: "Vector line shape.", usage: "Drag to draw." },
      { id: "shape-star", icon: Star, label: "Star", shortcut: "U", description: "5-point vector star.", usage: "Drag to draw." },
      { id: "shape-arrow", icon: ArrowRight, label: "Arrow", shortcut: "U", description: "Block arrow shape.", usage: "Drag to draw." },
      { id: "shape-custom", icon: Sparkles, label: "Custom Shape", shortcut: "U", description: "Decorative custom shape.", usage: "Drag to draw." },
      { id: "shape-rounded", icon: Squircle, label: "Rounded Rect", shortcut: "W", description: "Rectangle with round corners.", usage: "Drag to draw." },
      { id: "shape-diamond", icon: Diamond, label: "Diamond", shortcut: "W", description: "Four-point diamond.", usage: "Drag to draw." },
      { id: "shape-heart", icon: Heart, label: "Heart", shortcut: "W", description: "Bezier heart shape.", usage: "Drag to draw." },
      { id: "shape-hexagon", icon: Hexagon, label: "Hexagon", shortcut: "W", description: "Six-side hexagon.", usage: "Drag to draw." },
      { id: "shape-burst", icon: Award, label: "Burst", shortcut: "W", description: "12-spike starburst seal.", usage: "Drag to draw." },
      { id: "shape-donut", icon: Donut, label: "Donut", shortcut: "W", description: "Ring with transparent hole.", usage: "Drag to draw." },
      { id: "shape-chevron", icon: ChevronsRight, label: "Chevron", shortcut: "U", description: "Manual bold chevron arrow.", usage: "Drag to draw." },
      { id: "shape-moon", icon: Moon, label: "Moon", shortcut: "U", description: "Manual crescent moon.", usage: "Drag to draw." },
      { id: "shape-cross", icon: Cross, label: "Cross", shortcut: "U", description: "Manual rounded cross badge.", usage: "Drag to draw." },
      { id: "shape-plus", icon: Plus, label: "Plus", shortcut: "U", description: "Manual medical plus sign.", usage: "Drag to draw." },
      { id: "shape-trapezoid", icon: Triangle, label: "Trapezoid", shortcut: "U", description: "Manual perspective trapezoid.", usage: "Drag to draw." },
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
      { id: "pan", icon: Move, label: "Pan (Alt)", shortcut: "H", description: "Alternate pan for stylus.", usage: "Drag to pan." },
      { id: "rotate-view", icon: RotateCcw, label: "Rotate View", shortcut: "R", description: "Non-destructive view rotation.", usage: "Drag to rotate view." },
      { id: "zoom", icon: ZoomIn, label: "Zoom", shortcut: "Z", description: "Click zoom in, Alt-click zoom out.", usage: "Click / Alt-click." },
      { id: "zoom-fit", icon: Scan, label: "Fit Screen", shortcut: "6", description: "Fit document to screen.", usage: "Click canvas to fit." },
      { id: "zoom-100", icon: Maximize, label: "100%", shortcut: "6", description: "Actual pixels.", usage: "Click for 100%." },
      { id: "zoom-200", icon: Search, label: "200%", shortcut: "6", description: "Double detail.", usage: "Click for 200%." },
      { id: "zoom-400", icon: Microscope, label: "400%", shortcut: "6", description: "Pixel inspection.", usage: "Click for 400%." },
      { id: "zoom-50", icon: ZoomOut, label: "50%", shortcut: "6", description: "Manual half-size overview.", usage: "Click for 50%." },
      { id: "zoom-800", icon: Telescope, label: "800%", shortcut: "6", description: "Manual pixel-perfect 8x inspect.", usage: "Click for 800%." },
      { id: "rotate-reset", icon: Compass, label: "Reset Rotate", shortcut: "H", description: "Manual one-click reset view rotation.", usage: "Click to reset 0deg." },
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
      { id: "warmth-brush", icon: Flame, label: "Warmth Brush", shortcut: "Q", description: "Warm local color, cool shadows stay.", usage: "Paint to warm." },
      { id: "fade-brush", icon: TrendingDown, label: "Fade Brush", shortcut: "Q", description: "Soft matte fade toward mid gray.", usage: "Paint to fade." },
      { id: "contrast-brush", icon: Zap, label: "Contrast Brush", shortcut: "Q", description: "Local contrast around midtones.", usage: "Paint for punch." },
      { id: "posterize-brush", icon: Layers, label: "Posterize Brush", shortcut: "Q", description: "Four level posterize blend.", usage: "Paint for graphic tone." },
      { id: "threshold-brush", icon: ToggleLeft, label: "Threshold Brush", shortcut: "Q", description: "Local black and white snap.", usage: "Paint for graphic ink." },
      { id: "hue-brush", icon: RefreshCw, label: "Hue Brush", shortcut: "Q", description: "Rotate local hue gently.", usage: "Paint to shift hue." },
      { id: "invert-brush", icon: EyeOff, label: "Invert Brush", shortcut: "Q", description: "Local invert blend for drama.", usage: "Paint to invert." },
      { id: "desat-brush", icon: Droplet, label: "Desaturate Brush", shortcut: "Q", description: "Pull local saturation out.", usage: "Paint to mute color." },
      { id: "grain-brush", icon: Clapperboard, label: "Grain Brush", shortcut: "Q", description: "Add fine deterministic film grain.", usage: "Paint for texture." },
      { id: "pixelate-brush", icon: LayoutDashboard, label: "Pixelate Brush", shortcut: "Q", description: "Local mosaic for privacy or style.", usage: "Paint to pixelate." },
      { id: "vignette-brush", icon: Eclipse, label: "Vignette Brush", shortcut: "Q", description: "Darken dab edges like a lens.", usage: "Paint to vignette." },
      { id: "sepia-brush", icon: Coffee, label: "Sepia Brush", shortcut: "Q", description: "Manual warm sepia tone wash.", usage: "Paint for sepia." },
      { id: "bw-brush", icon: Circle, label: "B&W Brush", shortcut: "Q", description: "Manual clean black-white convert.", usage: "Paint for mono." },
      { id: "film-fade", icon: Film, label: "Film Fade", shortcut: "Q", description: "Manual lifted film matte fade.", usage: "Paint for film look." },
      { id: "split-tone", icon: Split, label: "Split Tone", shortcut: "Q", description: "Manual cool shadows warm highlights.", usage: "Paint for split tone." },
      { id: "hdr-brush", icon: Lightbulb, label: "HDR Brush", shortcut: "Q", description: "Manual punchy HDR micro-contrast.", usage: "Paint for HDR pop." },
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
            17 families, 226 sub-tools manual. Click a family icon to select. Click again to cycle variants. Right-click opens this panel.
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
