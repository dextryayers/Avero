import { useEffect, useMemo, useRef, useState } from "react";
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
  Paintbrush2,
  CupSoda,
  Fan,
  Egg,
  Flower2,
  Snowflake,
  Shirt,
  BrickWall,
  PencilLine,
  PencilRuler,
  Leaf,
  Book,
  Blocks,
  Slash,
  Pin,
  Flashlight,
  Lamp,
  AirVent,
  Tornado,
  PawPrint,
  Nut,
  Cherry,
  Grid2x2,
  ThermometerSun,
  HeartPulse,
  Meh,
  MoveDiagonal,
  Bird,
  Tag,
  Footprints,
  PlugZap,
  OctagonX,
  FlipVertical2,
  SunMoon,
  TrendingUp,
  Wheat,
  Wine,
  Bike,
  Anchor,
  LampDesk,
  ScanEye,
  TreePine,
  Palmtree,
  ThermometerSnowflake,
  Popcorn,
  CloudSun,
  Contact,
  Tent,
  Fullscreen,
  LoaderPinwheel,
  Milk,
  CircleCheck,
  FileText,
  Laptop,
  Landmark,
  Rocket,
  Shell,
  Maximize2,
  FoldHorizontal,
  UnfoldHorizontal,
  Sailboat,
  Martini,
  Milestone,
  LifeBuoy,
  Proportions,
  Pill,
  Undo2,
  Sprout,
  Image,
  Mail,
  BookOpen,
  Grid3x3,
  Disc3,
  Tv,
  Clock,
  TestTube,
  User,
  Medal,
  Underline,
  Bold,
  Route,
  ArrowLeftRight,
  Scaling,
  Pentagon,
  Octagon,
  Shield,
  Badge,
  Ribbon,
  MessageCircle,
  Cog,
  Crown,
  Ticket,
  Keyboard,
  Pilcrow,
  CassetteTape,
  Waypoints,
  NotebookPen,
  Calculator,
  PinOff,
  ScanSearch,
  RefreshCcw,
  Orbit,
  Radar,
  Sticker,
  Laugh,
  Glasses,
  SmilePlus,
  HeartHandshake,
  BedDouble,
  Drama,
  Bot,
  Satellite,
  ThumbsUp,
  HandHeart,
  Handshake,
  HandMetal,
  Pointer,
  Dices,
  PartyPopper,
  Squirrel,
  LeafyGreen,
  Skull,
  Fish,
  Bug,
  Pizza,
  Sandwich,
  Croissant,
  Utensils,
  Cake,
  IceCream,
  Candy,
  Lollipop,
  Apple,
  Citrus,
  Flower,
  Clover,
  ChefHat,
  Cat,
  Dog,
  Trophy,
  Gift,
  CloudHail,
  Binoculars,
  Ratio,
  StarHalf,
  Delete,
  Filter,
  Baseline,
  Puzzle,
  DropletOff,
  Bean,
  FlaskRound,
  CloudSnow,
  MoveDiagonal2,
  ALargeSmall,
  MapPinned,
  CircleOff,
  SquareDashedBottom,
  GalleryVertical,
  Scale,
  Layers2,
  SquarePlus,
  SquareMenu,
  RectangleEllipsis,
  CloudRain,
  CloudDrizzle,
  Cloudy,
  EyeClosed,
  Container,
  Turtle,
  Bolt,
  SunMedium,
  LocateFixed,
  LampCeiling,
  Gauge,
  ZapOff,
  SquareDashedKanban,
  ScanFace,
  Grid2x2Plus,
  MonitorUp,
  CircleDotDashed,
  CircleGauge,
  CircleSlash,
  CloudMoon,
  CloudOff,
  CloudSunRain,
  WindArrowDown,
  AudioWaveform,
  WavesLadder,
  ListFilter,
  Ship,
  DiamondPlus,
  DiamondMinus,
  SwatchBook,
  Coins,
  FlameKindling,
  FireExtinguisher,
  Heater,
  Drumstick,
  LayoutList,
  GalleryThumbnails,
  Grid2x2X,
  Locate,
  ShowerHead,
  View,
  SquareMinus,
  SeparatorHorizontal,
  Equal,
  Haze,
  CloudLightning,
  CopyPlus,
  CookingPot,
  Grape,
  ListFilterPlus,
  SunSnow,
  IceCreamBowl,
  Pyramid,
  DiamondPercent,
  SquareArrowUpRight,
  SlidersVertical,
  Boxes,
  LayoutPanelTop,
  RotateCcwSquare,
  RotateCwSquare,
  RefreshCcwDot,
  LampFloor,
  LampWallUp,
  UmbrellaOff,
  Move3d,
  HandHelping,
  MousePointerClick,
  SquareMousePointer,
  SquareDashedMousePointer,
  StretchVertical,
  MoveRight,
  UnfoldVertical,
  WholeWord,
  TrendingUpDown,
  ChartLine,
  PenOff,
  Slice,
  Umbrella,
  CloudRainWind,
  AlignCenterHorizontal,
  Wrench,
  ScissorsLineDashed,
  ThumbsDown,
  CopyCheck,
  CopyX,
  TriangleRight,
  SquareSplitHorizontal,
  Disc2,
  CirclePlus,
  TestTubes,
  Replace,
  OctagonAlert,
  Shuffle,
  BadgePlus,
  TicketPlus,
  GripHorizontal,
  Package,
  GitFork,
  MilkOff,
  Signature,
  Signpost,
  Torus,
  StarOff,
  BadgeCent,
  TicketCheck,
  DiscAlbum,
  Popsicle,
  CloudCog,
  BotOff,
  Shrub,
  TreeDeciduous,
  TestTubeDiagonal,
  CakeSlice,
  SquareCheck,
  Vegan,
  ArrowBigRight,
  SquareArrowRight,
  LassoSelect,
  Cookie,
  Text,
  SquareScissors,
  ClipboardCopy,
  Stethoscope,
  Italic,
  AppWindow,
  Minimize,
  Target,
  FlipHorizontal,
  Rabbit,
  Factory,
  Grid2x2Check,
  OctagonMinus,
  ArrowDownToDot,
  UserRound,
  SquareSplitVertical,
  Projector,
  TypeOutline,
  SquareArrowDown,
  Printer,
  ContactRound,
  Table,
  Divide,
  IterationCw,
  Flag,
  RouteOff,
  Wallpaper,
  Redo2,
  ArrowUpFromLine,
  GitBranch,
  Bone,
  Trash,
  Ban,
  Kanban,
  Frown,
  Banana,
  BugOff,
  ArrowUp,
  EggOff,
  Plug,
  HandPlatter,
  HandCoins,
  Trees,
  WheatOff,
  WashingMachine,
  GripVertical,
  Megaphone,
  Soup,
  Vault,
  ArrowBigUp,
  Loader,
  ArrowDownToLine,
  ArrowUpToLine,
  ArrowDown,
  Beer,
  SquareStack,
  FlipVertical,
  ClipboardPaste,
  Earth,
  Strikethrough,
  ToyBrick,
  FoldVertical,
  MessageSquareHeart,
  Bomb,
  Dessert,
  Castle,
  Navigation2,
  Upload,
  SearchCheck,
  IterationCcw,
  CircleMinus,
  Videotape,
  BicepsFlexed,
  CloudMoonRain,
  EggFried,
  ShieldPlus,
  CircleUser,
  MountainSnow,
  SquareBottomDashedScissors,
  ScrollText,
  TentTree,
  BadgePercent,
  BadgeCheck,
  Columns2,
  TicketPercent,
  Tags,
  Rows2,
  Ellipsis,
  AudioLines,
  SendHorizontal,
  CornerUpLeft,
  Images,
  ShieldHalf,
  Check,
  X,
  Dice4,
  Dice5,
  Dice6,
  Quote,
  PanelsTopLeft,
  Timer,
  EllipsisVertical,
  LoaderCircle,
  Bookmark,
  RadioTower,
  MailOpen,
  Phone,
  AlarmClock,
  GlobeLock,
  Webcam,
  Music,
  Ampersand,
  Share2,
  MessageSquarePlus,
  Play,
  Mic,
  QrCode,
  Speaker,
  SatelliteDish,
  Infinity as InfinityIcon,
  SquareDot,
  MapPinPlus,
  Atom,
  ArrowUpRight,
  FlagTriangleRight,
  Newspaper,
  Radio,
  Antenna,
  Presentation,
} from "lucide-react";
import { useEditorStore, type ToolId } from "../stores/useEditorStore";
import { STICKER_BY_ID, STICKER_CATEGORIES, STICKER_META, STICKER_USAGE } from "../engine/stickers";
import { paintStickerArt } from "../engine/stickerArt";
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

// One distinct lucide icon per sticker (uniqueness is enforced by tests).
// The grid renders live vector thumbnails in the brush color instead.
const STICKER_ICONS: Record<string, any> = {
  "sticker-smile": Smile,
  "sticker-laugh": Laugh,
  "sticker-wink": Frown,
  "sticker-cool": Glasses,
  "sticker-party-face": SmilePlus,
  "sticker-heart-eyes": HeartHandshake,
  "sticker-star-struck": CircleUser,
  "sticker-sleepy": BedDouble,
  "sticker-clown": Drama,
  "sticker-robot": Bot,
  "sticker-alien": Satellite,
  "sticker-ghost": BotOff,
  "sticker-thumbs-up": ThumbsUp,
  "sticker-ok-hand": CirclePlus,
  "sticker-peace": ThumbsDown,
  "sticker-pray": HandHeart,
  "sticker-clap": Handshake,
  "sticker-wave": HandPlatter,
  "sticker-rock-on": HandMetal,
  "sticker-love-you": Pointer,
  "sticker-red-heart": MessageSquareHeart,
  "sticker-sparkles": StarOff,
  "sticker-star": TicketCheck,
  "sticker-fire": Drumstick,
  "sticker-lightning": ZapOff,
  "sticker-hundred": Dices,
  "sticker-party-popper": PartyPopper,
  "sticker-balloon": Upload,
  "sticker-crown": Castle,
  "sticker-gem": Coins,
  "sticker-trophy": Trophy,
  "sticker-medal": Medal,
  "sticker-rocket": Rocket,
  "sticker-gift": Gift,
  "sticker-cat": Cat,
  "sticker-dog": Dog,
  "sticker-fox": Squirrel,
  "sticker-panda": LeafyGreen,
  "sticker-frog": Turtle,
  "sticker-monkey": Banana,
  "sticker-lion": Skull,
  "sticker-tiger": Bone,
  "sticker-unicorn": Megaphone,
  "sticker-chick": EggOff,
  "sticker-penguin": Fish,
  "sticker-butterfly": Bug,
  "sticker-ladybug": BugOff,
  "sticker-bee": Flower,
  "sticker-pizza": Pizza,
  "sticker-burger": Sandwich,
  "sticker-fries": Soup,
  "sticker-taco": Croissant,
  "sticker-sushi": Utensils,
  "sticker-donut": Dessert,
  "sticker-cupcake": Cake,
  "sticker-ice-cream": IceCream,
  "sticker-candy": Candy,
  "sticker-lollipop": Lollipop,
  "sticker-coffee": CakeSlice,
  "sticker-bubble-tea": Popsicle,
  "sticker-strawberry": Apple,
  "sticker-watermelon": Citrus,
  "sticker-sunflower": Flower2,
  "sticker-rose": TentTree,
  "sticker-cactus": TreeDeciduous,
  "sticker-mushroom": ChefHat,
  "sticker-sun": UmbrellaOff,
  "sticker-rainbow": CloudRainWind,
  "sticker-cloud": WindArrowDown,
  "sticker-snowflake": MountainSnow,
  "sticker-ocean-wave": Ship,
  "sticker-clover": Clover,
  "sticker-burst-big": BadgePercent,
  "sticker-seal-double": BadgeCheck,
  "sticker-ribbon-split": Columns2,
  "sticker-price-circle": TicketPercent,
  "sticker-tag-wide": Tags,
  "sticker-rule-double": Rows2,
  "sticker-rule-dotted": Ellipsis,
  "sticker-rule-zigzag": AudioLines,
  "sticker-arrow-divider": SendHorizontal,
  "sticker-corner-flourish": CornerUpLeft,
  "sticker-photo-corners": Images,
  "sticker-shield-mini": ShieldHalf,
  "sticker-check-seal": Check,
  "sticker-cross-seal": X,
  "sticker-step-four": Dice4,
  "sticker-step-five": Dice5,
  "sticker-step-six": Dice6,
  "sticker-quote-big": Quote,
  "sticker-frame-double": PanelsTopLeft,
  "sticker-rosette": Timer,
  "sticker-divider-dots": EllipsisVertical,
  "sticker-frame-rings": LoaderCircle,
  "sticker-banner-tall": Bookmark,
  "sticker-sparkle-ring": RadioTower,
  "sticker-envelope": MailOpen,
  "sticker-phone": Phone,
  "sticker-clock": AlarmClock,
  "sticker-globe": GlobeLock,
  "sticker-camera": Webcam,
  "sticker-music": Music,
  "sticker-hash": Ampersand,
  "sticker-share": Share2,
  "sticker-chat-dots": MessageSquarePlus,
  "sticker-play": Play,
  "sticker-mic": Mic,
  "sticker-qr": QrCode,
  "sticker-confetti": Speaker,
  "sticker-starfield": SatelliteDish,
  "sticker-rainbow-rings": InfinityIcon,
  "sticker-dots-fade": SquareDot,
  "sticker-plus-field": MapPinPlus,
  "sticker-grain-fine": Atom,
  "sticker-leak": ArrowUpRight,
  "sticker-prism": FlagTriangleRight,
  "sticker-checker-fade": Newspaper,
  "sticker-wave-band": Radio,
  "sticker-ring-burst": Antenna,
  "sticker-spotlight": Presentation,
};

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
      { id: "move", icon: Move3d, label: "Move Tool", shortcut: "V", description: "Move active layer. Shift snaps to guides.", usage: "Drag layer. Shift = snap. Ctrl+T = free transform." },
      { id: "artboard", icon: LayoutDashboard, label: "Artboard Tool", shortcut: "V", description: "Create and arrange artboards for multi-canvas work.", usage: "Drag to create an artboard." },
      { id: "path-select", icon: MousePointer, label: "Path Selection", shortcut: "A", description: "Select a whole vector path.", usage: "Click any shape or text item to select it. Then move it directly or use handles to scale and rotate." },
      { id: "direct-select", icon: MousePointerClick, label: "Direct Selection", shortcut: "A", description: "Select vector and text items directly.", usage: "Click a shape or text layer to select it. Drag to rotate. Use the box to move, scale and rotate." },
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
      { id: "select-rect", icon: SquareMousePointer, label: "Rectangular Marquee", shortcut: "M", description: "Rectangular selection. Shift adds, Alt subtracts.", usage: "Drag to select an area. Click a layer to select it for move, scale and rotate. Feather in Select panel." },
      { id: "select-ellipse", icon: CircleDashed, label: "Elliptical Marquee", shortcut: "M", description: "Elliptical selection for round areas.", usage: "Drag to select an area. Click a layer to select it for move, scale and rotate. Shift = circle." },
      { id: "single-row", icon: Minus, label: "Single Row Marquee", shortcut: "M", description: "Select a single 1px horizontal row.", usage: "Click a row to select it." },
      { id: "single-column", icon: SeparatorVertical, label: "Single Column Marquee", shortcut: "M", description: "Select a single 1px vertical column.", usage: "Click a column to select it." },
      { id: "select-rounded", icon: Squircle, label: "Rounded Marquee", shortcut: "Y", description: "Rectangle with soft rounded corners.", usage: "Drag to select an area. Click a layer to select it for move, scale and rotate." },
      { id: "select-grow", icon: Expand, label: "Grow Selection", shortcut: "Y", description: "Expand current selection 4px.", usage: "Click to grow." },
      { id: "select-shrink", icon: Shrink, label: "Shrink Selection", shortcut: "Y", description: "Contract current selection 4px.", usage: "Click to shrink." },
      { id: "select-square", icon: SquareDashedBottom, label: "Square Marquee", shortcut: "M", description: "Square-locked marquee for icons and avatars.", usage: "Drag to select a square. Click a layer to select it for move, scale and rotate." },
      { id: "select-feather", icon: CloudHail, label: "Feather Select", shortcut: "M", description: "Soften current selection edge 6px.", usage: "Click to feather. Needs a selection first." },
      { id: "select-border", icon: Orbit, label: "Border Smooth", shortcut: "M", description: "Smooth and tighten selection border.", usage: "Click to smooth border." },
      { id: "select-circle", icon: Circle, label: "Circle Marquee", shortcut: "M", description: "Perfect circle selection, round locked.", usage: "Drag to select a circle. Click a layer to select it for move, scale and rotate." },
      { id: "select-stadium", icon: Pill, label: "Stadium Marquee", shortcut: "M", description: "Capsule selection for pills and tags.", usage: "Drag to select a capsule. Click a layer to select it for move, scale and rotate." },
      { id: "select-crosshair", icon: Crosshair, label: "Crosshair Select", shortcut: "M", description: "Cross shaped selection mirrored both ways from the start point.", usage: "Drag out from center to select a cross. Click a layer to select it for move, scale and rotate." },
      { id: "select-last", icon: Undo2, label: "Reselect Last", shortcut: "M", description: "Restore the previous selection.", usage: "Click to restore selection." },
      { id: "select-inverse-click", icon: FlipHorizontal2, label: "Invert Click", shortcut: "M", description: "Invert the current selection.", usage: "Click to invert." },
      { id: "select-feather-2", icon: Feather, label: "Feather 2px", shortcut: "Y", description: "Quick soft 2px edge feather.", usage: "Click to feather 2px." },
      { id: "select-feather-4", icon: Wind, label: "Feather 4px", shortcut: "Y", description: "Quick soft 4px edge feather.", usage: "Click to feather 4px." },
      { id: "select-feather-12", icon: CloudFog, label: "Feather 12px", shortcut: "Y", description: "Soft dreamy 12px edge feather.", usage: "Click to feather 12px." },
      { id: "select-grow-2", icon: UnfoldHorizontal, label: "Grow 2px", shortcut: "Y", description: "Grow selection by 2px.", usage: "Click to grow 2px." },
      { id: "select-grow-8", icon: TrendingUp, label: "Grow 8px", shortcut: "Y", description: "Grow selection by 8px.", usage: "Click to grow 8px." },
      { id: "select-border-4", icon: SquareBottomDashedScissors, label: "Border 4px", shortcut: "Y", description: "Tight 4px border smooth.", usage: "Click for 4px border." },
      { id: "select-border-12", icon: SquareDashedKanban, label: "Border 12px", shortcut: "Y", description: "Wide 12px border smooth.", usage: "Click for 12px border." },
      { id: "select-cursor", icon: SquareDashedMousePointer, label: "Select Cursor", shortcut: "M", description: "Cursor for clicking items and layers.", usage: "Click any item or layer to select it, then drag to move and use handles to scale or rotate." },
    ],
  },
  {
    id: "lasso",
    label: "Lasso",
    icon: Lasso,
    shortcut: "L",
    description: "Freehand, polygonal, wand and AI-assisted selections.",
    tools: [
      { id: "select-lasso", icon: LassoSelect, label: "Lasso", shortcut: "L", description: "Freehand selection. Close path to finish.", usage: "Drag freely, release near start. Click a layer to select it for move, scale and rotate." },
      { id: "select-polygon", icon: Hexagon, label: "Polygonal Lasso", shortcut: "L", description: "Straight-edge polygon selection.", usage: "Click points, double-click to close." },
      { id: "magnetic-lasso", icon: Magnet, label: "Magnetic Lasso", shortcut: "Y", description: "Freehand with edge snap + expand.", usage: "Drag around edges. Click a layer to select it for move, scale and rotate." },
      { id: "object-select", icon: ScanFace, label: "Object Select", shortcut: "W", description: "Auto rectangular object detection.", usage: "Drag around an object." },
      { id: "quick-select", icon: Binoculars, label: "Quick Select", shortcut: "W", description: "Brush-based auto selection.", usage: "Paint over the subject." },
      { id: "wand", icon: Wand2, label: "Magic Wand", shortcut: "W", description: "Select similar colors by tolerance.", usage: "Click an area. Tolerance in Select panel." },
      { id: "wand-plus", icon: Radar, label: "Wand Grow", shortcut: "Y", description: "Wand then auto-grow 2px.", usage: "Click to select larger." },
      { id: "wand-minus", icon: Wand, label: "Wand Shrink", shortcut: "Y", description: "Wand then auto-shrink 2px.", usage: "Click for tighter select." },
      { id: "color-range", icon: Palette, label: "Color Range", shortcut: "W", description: "Select every pixel similar to the clicked color.", usage: "Click a color. Tolerance in options bar." },
      { id: "select-subject", icon: Target, label: "Select Subject", shortcut: "W", description: "One-click auto subject selection.", usage: "Click anywhere on the subject." },
      { id: "sky-select", icon: Cloud, label: "Sky Select", shortcut: "W", description: "Manual sky band select top 62 percent.", usage: "Click to select sky area." },
      { id: "background-select", icon: Mountain, label: "Background Select", shortcut: "W", description: "Manual background pick from corners.", usage: "Click to select background tone." },
      { id: "focus-select", icon: Locate, label: "Focus Select", shortcut: "W", description: "Center ellipse focus area with feather.", usage: "Click to select center focus." },
      { id: "lasso-straight", icon: Slash, label: "Straight Lasso", shortcut: "L", description: "Click points with 45 degree Shift snap.", usage: "Click corners, double-click closes." },
      { id: "wand-flood", icon: CloudRain, label: "Wand Flood", shortcut: "W", description: "Full region flood select with adaptive tolerance.", usage: "Click to flood select." },
      { id: "range-skin", icon: User, label: "Skin Range", shortcut: "W", description: "Select the full skin tone range.", usage: "Click skin tones." },
      { id: "range-sky", icon: CloudSun, label: "Sky Range", shortcut: "W", description: "Select the full blue sky range.", usage: "Click sky tones." },
      { id: "range-greens", icon: Sprout, label: "Greens Range", shortcut: "W", description: "Select the full foliage green range.", usage: "Click green tones." },
    ],
  },
  {
    id: "sticker",
    label: "Sticker",
    icon: Sticker,
    shortcut: "K",
    description: "72 professional assets across marks, badges, frames, labels, nature and FX. Pick one in the grid, then click the canvas to place it.",
    tools: STICKER_META.map((s) => ({
      id: s.id as ToolId,
      icon: STICKER_ICONS[s.id] ?? Sticker,
      label: s.label,
      shortcut: "K",
      description: s.description,
      usage: STICKER_USAGE,
    })),
  },
  {
    id: "crop",
    label: "Crop",
    icon: Crop,
    shortcut: "C",
    description: "Crop presets, slice, frame and upscale.",
    tools: [
      { id: "crop", icon: SquareScissors, label: "Crop", shortcut: "C", description: "Crop document. Enter applies, Esc cancels.", usage: "Drag area, Enter to apply." },
      { id: "perspective-crop", icon: Rotate3d, label: "Perspective Crop", shortcut: "C", description: "Crop with perspective correction.", usage: "Drag area, adjust corners." },
      { id: "crop-169", icon: Monitor, label: "Crop 16:9", shortcut: "A", description: "Widescreen crop locked 16:9.", usage: "Drag, ratio locked." },
      { id: "crop-43", icon: RectangleHorizontal, label: "Crop 4:3", shortcut: "A", description: "Classic photo ratio 4:3.", usage: "Drag, ratio locked." },
      { id: "crop-11", icon: GalleryVertical, label: "Crop 1:1", shortcut: "A", description: "Square crop for avatars.", usage: "Drag square." },
      { id: "crop-32", icon: Camera, label: "Crop 3:2", shortcut: "A", description: "Full-frame 3:2 ratio.", usage: "Drag, ratio locked." },
      { id: "crop-free", icon: SquareDashed, label: "Crop Free", shortcut: "A", description: "Free crop, no lock.", usage: "Drag freely." },
      { id: "crop-straighten", icon: AlignCenterHorizontal, label: "Straighten", shortcut: "A", description: "Crop + auto-level horizon.", usage: "Drag horizon line." },
      { id: "slice", icon: Scissors, label: "Slice", shortcut: "C", description: "Cut export slices.", usage: "Drag to define a slice." },
      { id: "slice-select", icon: Copy, label: "Slice Select", shortcut: "C", description: "Select and move slices.", usage: "Click a slice." },
      { id: "frame", icon: Frame, label: "Frame", shortcut: "K", description: "Placeholder frame for images.", usage: "Drag to create a frame." },
      { id: "crop-219", icon: StretchVertical, label: "Crop 21:9", shortcut: "A", description: "Ultrawide cinematic 21:9.", usage: "Drag, ratio locked." },
      { id: "crop-45", icon: RectangleVertical, label: "Crop 4:5", shortcut: "A", description: "Portrait social 4:5.", usage: "Drag, ratio locked." },
      { id: "crop-916", icon: Smartphone, label: "Crop 9:16", shortcut: "A", description: "Vertical story 9:16.", usage: "Drag, ratio locked." },
      { id: "crop-golden", icon: Ratio, label: "Crop Golden", shortcut: "A", description: "Golden ratio 1.618 premium crop.", usage: "Drag, ratio locked." },
      { id: "crop-55", icon: Image, label: "Crop 5:4", shortcut: "A", description: "Large format 5:4 photo ratio.", usage: "Drag, ratio locked." },
      { id: "crop-a4", icon: FileText, label: "Crop A4", shortcut: "A", description: "A4 print ratio crop.", usage: "Drag, ratio locked." },
      { id: "crop-letter", icon: Mail, label: "Crop Letter", shortcut: "A", description: "US Letter print ratio crop.", usage: "Drag, ratio locked." },
      { id: "crop-47", icon: Contact, label: "Crop 4:6", shortcut: "A", description: "Passport 4:6 print ratio crop.", usage: "Drag, ratio locked." },
      { id: "crop-58", icon: BookOpen, label: "Crop 5:7", shortcut: "A", description: "Classic 5:7 photo print crop.", usage: "Drag, ratio locked." },
      { id: "crop-thirds", icon: Grid3x3, label: "Thirds Overlay", shortcut: "C", description: "Rule of thirds composition guides.", usage: "Click, then crop." },
      { id: "crop-diagonal", icon: MoveDiagonal, label: "Diagonal Overlay", shortcut: "C", description: "Diagonal composition guides.", usage: "Click, then crop." },
      { id: "crop-triangle-guide", icon: Triangle, label: "Triangle Overlay", shortcut: "C", description: "Triangle composition guides.", usage: "Click, then crop." },
      { id: "crop-golden-spiral", icon: Shell, label: "Spiral Overlay", shortcut: "C", description: "Golden spiral composition guide.", usage: "Click, then crop." },
      { id: "crop-center-dot", icon: CircleDot, label: "Center Overlay", shortcut: "C", description: "Center dot composition guide.", usage: "Click, then crop." },
    ],
  },
  {
    id: "measure",
    label: "Measure",
    icon: Pipette,
    shortcut: "I",
    description: "Sample color, measure, angle, area and annotate.",
    tools: [
      { id: "eyedropper", icon: TestTubes, label: "Eyedropper", shortcut: "I", description: "Pick a color from canvas.", usage: "Click canvas to sample." },
      { id: "color-sampler", icon: MapPin, label: "Color Sampler", shortcut: "I", description: "Persistent color readout point.", usage: "Click to place a sampler." },
      { id: "sampler-avg", icon: DropletOff, label: "Average Sampler", shortcut: "5", description: "5x5 average color pin.", usage: "Click to pin average." },
      { id: "ruler", icon: Ruler, label: "Ruler", shortcut: "I", description: "Measure distance and angle.", usage: "Drag to measure." },
      { id: "measure-angle", icon: TriangleRight, label: "Angle", shortcut: "5", description: "Measure angle from horizontal.", usage: "Drag to measure angle." },
      { id: "measure-area", icon: Scale, label: "Area", shortcut: "5", description: "Drag rect for W x H + area.", usage: "Drag rectangle." },
      { id: "snap-toggle", icon: Zap, label: "Snap Toggle", shortcut: "5", description: "Toggle snapping on/off.", usage: "Click to toggle." },
      { id: "note", icon: StickyNote, label: "Note", shortcut: "I", description: "Attach a note to canvas.", usage: "Click to add a note." },
      { id: "count", icon: Hash, label: "Count", shortcut: "I", description: "Count objects with numbered markers.", usage: "Click to add a count." },
      { id: "protractor", icon: DraftingCompass, label: "Protractor", shortcut: "I", description: "Manual angle measure with label.", usage: "Drag to measure angle." },
      { id: "guide-clear", icon: EyeOff, label: "Clear Guides", shortcut: "I", description: "One click removes all guides.", usage: "Click canvas to clear guides." },
      { id: "grid-toggle", icon: LayoutList, label: "Grid Toggle", shortcut: "I", description: "One click toggles Photoshop grid.", usage: "Click canvas to toggle grid." },
      { id: "ruler-triple", icon: Waypoints, label: "Triple Ruler", shortcut: "I", description: "Chained three point measure.", usage: "Click three points." },
      { id: "measure-dpi", icon: Scaling, label: "DPI Check", shortcut: "5", description: "Print scale for A4 and Letter.", usage: "Click for print scale." },
      { id: "guide-mid", icon: Plus, label: "Center Guides", shortcut: "I", description: "Add center horizontal plus vertical guides.", usage: "Click to add guides." },
      { id: "guide-thirds", icon: Table, label: "Thirds Guides", shortcut: "I", description: "Add rule of thirds guides.", usage: "Click to add guides." },
      { id: "guide-clear-one", icon: PinOff, label: "Remove One Guide", shortcut: "I", description: "Remove the guide nearest the click.", usage: "Click near a guide." },
      { id: "grid-pixel", icon: Grid2x2, label: "Pixel Grid", shortcut: "5", description: "8px pixel grid for precise work.", usage: "Click to toggle pixel grid." },
      { id: "note-color", icon: NotebookPen, label: "Color Note", shortcut: "I", description: "Pin a color coded note.", usage: "Click to pin note." },
      { id: "count-auto", icon: Calculator, label: "Auto Count", shortcut: "I", description: "Auto count bright blobs, max 99.", usage: "Click to auto count." },
      { id: "sampler-3x3", icon: Grid2x2Check, label: "Sampler 3x3", shortcut: "5", description: "Tight 3x3 color pin.", usage: "Click to pin color." },
      { id: "sampler-11x11", icon: Grid2x2Plus, label: "Sampler 11x11", shortcut: "5", description: "Wide 11x11 average pin.", usage: "Click to pin average." },
    ],
  },
  {
    id: "brush",
    label: "Brush",
    icon: Brush,
    shortcut: "B",
    description: "Paint, sketch and art engines, 23 variants.",
    tools: [
      { id: "brush", icon: Cookie, label: "Brush", shortcut: "B", description: "Soft round brush with smoothing.", usage: "Paint freely. [ ] = size." },
      { id: "pencil", icon: Pencil, label: "Pencil", shortcut: "B", description: "Hard 1px edge, no anti-alias.", usage: "Pixel-precise strokes." },
      { id: "airbrush", icon: SprayCan, label: "Airbrush", shortcut: "B", description: "Soft spray buildup, low flow per dab.", usage: "Hold to build up tone." },
      { id: "soft-brush", icon: Paintbrush, label: "Soft Brush", shortcut: "B", description: "Extra-large feather for blending.", usage: "Blend and soften." },
      { id: "color-replacement", icon: Replace, label: "Color Replacement", shortcut: "B", description: "Replace hue while keeping luminance.", usage: "Paint over target color." },
      { id: "mixer-brush", icon: FlaskConical, label: "Mixer Brush", shortcut: "B", description: "Wet oil-paint color mixing.", usage: "Paint to mix wet colors." },
      { id: "overlay-brush", icon: Blend, label: "Overlay Brush", shortcut: "B", description: "Paint contrast and light with overlay blend.", usage: "Paint for soft light contrast." },
      { id: "sketch-charcoal", icon: Contrast, label: "Charcoal", shortcut: "N", description: "Grainy dark charcoal with texture.", usage: "Sketch with rough grain." },
      { id: "sketch-pastel", icon: CloudMoon, label: "Pastel", shortcut: "N", description: "Soft chalky pastel, low opacity buildup.", usage: "Soft shading strokes." },
      { id: "sketch-marker", icon: PenLine, label: "Marker", shortcut: "N", description: "Flat saturated marker, hard edge.", usage: "Bold flat strokes." },
      { id: "sketch-highlighter", icon: Highlighter, label: "Highlighter", shortcut: "N", description: "Translucent highlight glaze.", usage: "Glaze over areas." },
      { id: "sketch-ink", icon: Signature, label: "Ink Pen", shortcut: "N", description: "Crisp ink line, full opacity.", usage: "Crisp line work." },
      { id: "sketch-felt", icon: Pen, label: "Felt Tip", shortcut: "N", description: "Soft felt tip, medium bleed.", usage: "Sketch lines." },
      { id: "sketch-neon", icon: Bolt, label: "Neon", shortcut: "N", description: "Additive glow stroke for light effects.", usage: "Paint glowing lines." },
      { id: "sketch-chalk", icon: Sparkle, label: "Chalk", shortcut: "N", description: "Dusty chalk with scatter.", usage: "Dusty strokes." },
      { id: "art-oil", icon: PaintRoller, label: "Oil Brush", shortcut: "F", description: "Thick oil paint with wet mixing.", usage: "Paint thick oils." },
      { id: "art-watercolor", icon: CloudDrizzle, label: "Watercolor", shortcut: "F", description: "Translucent watercolor wash.", usage: "Wash lightly." },
      { id: "art-knife", icon: ScissorsLineDashed, label: "Palette Knife", shortcut: "F", description: "Flat knife scrape with hard edge.", usage: "Scrape flat color." },
      { id: "art-smear", icon: Waves, label: "Finger Smear", shortcut: "F", description: "Smear pixels like a finger.", usage: "Drag to smear." },
      { id: "art-glaze", icon: GlassWater, label: "Glaze", shortcut: "F", description: "Thin transparent color glaze.", usage: "Glaze thin color." },
      { id: "art-impasto", icon: Hammer, label: "Impasto", shortcut: "F", description: "Heavy impasto with contrast punch.", usage: "Heavy strokes." },
      { id: "art-canvas", icon: GalleryThumbnails, label: "Canvas Texture", shortcut: "F", description: "Weave texture tinted with brush color.", usage: "Stamp texture." },
      { id: "art-poster", icon: Star, label: "Poster Brush", shortcut: "F", description: "Graphic posterize blend stroke.", usage: "Graphic strokes." },
      { id: "brush-dry", icon: Wheat, label: "Dry Brush", shortcut: "B", description: "Manual dry bristle with scatter.", usage: "Paint textured dry strokes." },
      { id: "brush-wet", icon: Beaker, label: "Wet Blend", shortcut: "B", description: "Manual wet mix canvas plus brush color.", usage: "Paint to blend wet." },
      { id: "brush-glitter", icon: StarHalf, label: "Glitter", shortcut: "B", description: "Manual sparkle scatter additive.", usage: "Paint sparkles." },
      { id: "brush-smoke", icon: Factory, label: "Smoke", shortcut: "B", description: "Manual soft smoke wash extra large.", usage: "Wash soft smoke." },
      { id: "brush-fur", icon: Rabbit, label: "Fur", shortcut: "N", description: "Manual fibrous multiply scatter.", usage: "Paint fur texture." },
      { id: "brush-inkwash", icon: ScrollText, label: "Ink Wash", shortcut: "N", description: "Manual east-ink wash multiply glaze.", usage: "Wash ink tones." },
      { id: "dry-flat", icon: Paintbrush2, label: "Dry Flat", shortcut: "B", description: "Flat dry brush with broken bristle edge.", usage: "Paint textured dry strokes." },
      { id: "dry-round", icon: CircleDotDashed, label: "Dry Round", shortcut: "B", description: "Round dry brush with soft broken center.", usage: "Paint round dry strokes." },
      { id: "wet-glaze", icon: CupSoda, label: "Wet Glaze", shortcut: "B", description: "Wet glaze wash that tints without covering.", usage: "Glaze thin color." },
      { id: "wet-palette", icon: CookingPot, label: "Wet Palette", shortcut: "B", description: "Palette knife wet blend, mixes as it paints.", usage: "Blend wet color." },
      { id: "oil-fan", icon: Fan, label: "Oil Fan", shortcut: "F", description: "Fan brush for soft blended oil strokes.", usage: "Blend oils softly." },
      { id: "oil-filbert", icon: Egg, label: "Oil Filbert", shortcut: "F", description: "Filbert oil brush with round tapered strokes.", usage: "Paint tapered oils." },
      { id: "water-bloom", icon: Trees, label: "Water Bloom", shortcut: "F", description: "Watercolor bloom with backrun edges.", usage: "Wash with blooms." },
      { id: "water-salt", icon: Snowflake, label: "Water Salt", shortcut: "F", description: "Salt texture watercolor with grain speckle.", usage: "Paint grainy wash." },
      { id: "gouache-flat", icon: Layers2, label: "Gouache Flat", shortcut: "B", description: "Flat opaque gouache coverage.", usage: "Cover flat opaque." },
      { id: "gouache-velvet", icon: Shirt, label: "Gouache Velvet", shortcut: "B", description: "Velvet matte gouache with zero shine.", usage: "Paint matte velvet." },
      { id: "acrylic-bristle", icon: Wrench, label: "Acrylic Bristle", shortcut: "B", description: "Stiff acrylic bristle with visible streaks.", usage: "Paint stiff streaks." },
      { id: "air-soft", icon: CloudCog, label: "Air Soft", shortcut: "B", description: "Whisper soft airbrush for vignettes.", usage: "Mist soft tone." },
      { id: "air-texture", icon: BrickWall, label: "Air Texture", shortcut: "B", description: "Textured airbrush with fine grain.", usage: "Spray grainy tone." },
      { id: "pencil-2b", icon: PencilLine, label: "Pencil 2B", shortcut: "B", description: "Classic 2B graphite with mid gray.", usage: "Sketch mid gray." },
      { id: "pencil-6b", icon: PencilRuler, label: "Pencil 6B", shortcut: "B", description: "Dark 6B graphite with near black core.", usage: "Sketch dark lines." },
      { id: "charcoal-vine", icon: Shrub, label: "Vine Charcoal", shortcut: "N", description: "Thin vine charcoal for sketch lines.", usage: "Sketch thin lines." },
      { id: "chalk-oil", icon: Book, label: "Oil Chalk", shortcut: "N", description: "Oily chalk with rich waxy cover.", usage: "Paint waxy chalk." },
      { id: "crayon-wax", icon: Blocks, label: "Wax Crayon", shortcut: "N", description: "Waxy crayon with paper tooth.", usage: "Draw waxy lines." },
      { id: "pastel-hard", icon: Grip, label: "Hard Pastel", shortcut: "N", description: "Hard pastel stick, sharp and dry.", usage: "Draw sharp pastel." },
      { id: "ink-brush", icon: TestTubeDiagonal, label: "Ink Brush", shortcut: "N", description: "Loaded ink brush with wet black wash.", usage: "Paint wet ink." },
      { id: "ink-nib", icon: PenOff, label: "Ink Nib", shortcut: "N", description: "Sharp nib line with pressure taper.", usage: "Draw sharp nib." },
      { id: "liner-fine", icon: Navigation2, label: "Fine Liner", shortcut: "N", description: "Ultra fine liner for details and lashes.", usage: "Draw fine details." },
      { id: "marker-chisel", icon: Italic, label: "Chisel Marker", shortcut: "N", description: "Chisel marker with flat calligraphy edge.", usage: "Draw flat strokes." },
      { id: "neon-tube", icon: Flashlight, label: "Neon Tube", shortcut: "N", description: "Hot neon tube with white core glow.", usage: "Paint neon tubes." },
      { id: "glow-soft", icon: Lamp, label: "Soft Glow", shortcut: "N", description: "Soft ambient glow halo.", usage: "Paint soft halos." },
      { id: "glitter-fine", icon: Diamond, label: "Fine Glitter", shortcut: "B", description: "Fine cosmetic glitter sparkle.", usage: "Paint fine sparkle." },
      { id: "glitter-chunk", icon: Gem, label: "Chunk Glitter", shortcut: "B", description: "Chunky craft glitter flakes.", usage: "Paint chunky flakes." },
      { id: "smoke-thin", icon: AirVent, label: "Thin Smoke", shortcut: "B", description: "Thin wisp of smoke for atmosphere.", usage: "Paint thin wisps." },
      { id: "smoke-bill", icon: Tornado, label: "Smoke Billow", shortcut: "B", description: "Thick smoke billow for drama.", usage: "Paint thick smoke." },
      { id: "fur-short", icon: PawPrint, label: "Short Fur", shortcut: "N", description: "Short dense fur stipple.", usage: "Paint short fur." },
    ],
  },
  {
    id: "eraser",
    label: "Eraser",
    icon: Eraser,
    shortcut: "E",
    description: "Erase with three different modes.",
    tools: [
      { id: "eraser", icon: Trash, label: "Eraser", shortcut: "E", description: "Soft standard eraser. Paints mask when mask mode is on.", usage: "Drag to erase." },
      { id: "background-eraser", icon: Ghost, label: "Background Eraser", shortcut: "E", description: "Erases only colors similar to sampled edge.", usage: "Drag along background edge." },
      { id: "magic-eraser", icon: Delete, label: "Magic Eraser", shortcut: "E", description: "One-click flood erase of flat areas.", usage: "Click a flat area." },
      { id: "eraser-hard", icon: Box, label: "Hard Eraser", shortcut: "E", description: "100% hard block eraser for pixel work.", usage: "Drag for hard erase." },
      { id: "eraser-soft", icon: Haze, label: "Soft Eraser", shortcut: "E", description: "Manual extra-soft zero-hardness erase.", usage: "Drag for soft erase." },
      { id: "eraser-block", icon: SquarePlus, label: "Block Eraser", shortcut: "E", description: "Manual pixel-block hard erase.", usage: "Drag for block erase." },
    ],
  },
  {
    id: "heal",
    label: "Heal",
    icon: Bandage,
    shortcut: "J",
    description: "Remove spots, heal, retouch skin and fill content.",
    tools: [
      { id: "spot-heal", icon: Stethoscope, label: "Spot Healing", shortcut: "J", description: "Auto-blend spots with surroundings.", usage: "Click or paint over blemishes." },
      { id: "healing-brush", icon: Syringe, label: "Healing Brush", shortcut: "J", description: "Alt-click source, precise healing.", usage: "Alt-click source, then paint." },
      { id: "patch", icon: Layers, label: "Patch", shortcut: "J", description: "Drag source area onto target.", usage: "Drag source to target." },
      { id: "content-move", icon: MoveRight, label: "Content-Aware Move", shortcut: "J", description: "Move object, background auto-fills.", usage: "Drag an object." },
      { id: "content-fill", icon: LayoutGrid, label: "Content Fill", shortcut: "J", description: "Fill selection with surrounding texture.", usage: "Select area, click to fill." },
      { id: "red-eye", icon: OctagonAlert, label: "Red Eye", shortcut: "J", description: "One-click red-eye correction.", usage: "Click red eyes." },
      { id: "heal-dust", icon: Filter, label: "Dust Remove", shortcut: "8", description: "Tiny spot heal for dust.", usage: "Click dust spots." },
      { id: "heal-wrinkle", icon: AudioWaveform, label: "Wrinkle Soften", shortcut: "8", description: "Gentle soften for skin lines.", usage: "Paint wrinkles." },
      { id: "heal-blemish", icon: Disc2, label: "Blemish Pro", shortcut: "8", description: "Stronger blemish blend.", usage: "Paint blemishes." },
      { id: "heal-sky", icon: Cloudy, label: "Sky Clean", shortcut: "8", description: "Wide soft clean for sky.", usage: "Paint sky spots." },
      { id: "heal-skin", icon: Bean, label: "Skin Smooth", shortcut: "8", description: "Edge-safe skin smooth.", usage: "Paint skin." },
      { id: "heal-object", icon: Trash2, label: "Object Erase", shortcut: "8", description: "Content fill erase for objects.", usage: "Paint object." },
      { id: "heal-freckle", icon: Dot, label: "Freckle Clean", shortcut: "J", description: "Manual tiny freckle and dust clean.", usage: "Click freckles." },
      { id: "heal-eye", icon: Eye, label: "Eye Bag Soften", shortcut: "J", description: "Manual gentle under-eye soften.", usage: "Paint eye bags." },
      { id: "heal-teeth", icon: SquareCheck, label: "Teeth Whiten", shortcut: "J", description: "Manual edge-safe whiten smooth.", usage: "Paint teeth." },
      { id: "heal-mole", icon: Nut, label: "Mole Heal", shortcut: "J", description: "Blend moles and dark spots into skin.", usage: "Paint moles." },
      { id: "heal-acne", icon: Cherry, label: "Acne Calm", shortcut: "J", description: "Calm red acne bumps without plastic skin.", usage: "Paint acne." },
      { id: "heal-scar-fade", icon: Slice, label: "Scar Fade", shortcut: "J", description: "Fade scar edges over repeated passes.", usage: "Paint scars." },
      { id: "heal-shine", icon: SunDim, label: "Shine Cut", shortcut: "8", description: "Cut oily shine while keeping skin texture.", usage: "Paint shiny zones." },
      { id: "heal-pores", icon: GripHorizontal, label: "Pore Refine", shortcut: "8", description: "Refine visible pores with micro smooth.", usage: "Paint pores." },
      { id: "heal-tan-line", icon: ThermometerSun, label: "Tan Line Blend", shortcut: "8", description: "Blend tan lines into surrounding tone.", usage: "Paint tan lines." },
      { id: "heal-veins", icon: HeartPulse, label: "Vein Soften", shortcut: "8", description: "Soften red eye veins gently.", usage: "Paint veins." },
      { id: "heal-chapped", icon: Meh, label: "Lip Smooth", shortcut: "J", description: "Smooth chapped lips, keep lip line.", usage: "Paint lips." },
      { id: "heal-stray-hair", icon: Divide, label: "Stray Hair", shortcut: "J", description: "Remove single stray hairs precisely.", usage: "Paint stray hairs." },
      { id: "heal-flyaway", icon: Bird, label: "Flyaway Tame", shortcut: "J", description: "Tame flyaway halo around hair.", usage: "Paint flyaways." },
      { id: "heal-price-tag", icon: Tag, label: "Price Tag Erase", shortcut: "8", description: "Erase price tags and stickers from product shots.", usage: "Paint price tags." },
      { id: "heal-tourist", icon: Footprints, label: "Tourist Remove", shortcut: "8", description: "Remove tourists and passersby from scenes.", usage: "Paint tourists." },
      { id: "heal-wire", icon: PlugZap, label: "Wire Remove", shortcut: "8", description: "Remove power lines and cables from skies.", usage: "Paint wires." },
      { id: "heal-trash", icon: OctagonX, label: "Trash Remove", shortcut: "8", description: "Remove litter and small trash from scenes.", usage: "Paint litter." },
      { id: "heal-reflection", icon: FlipVertical2, label: "Reflection Calm", shortcut: "8", description: "Calm harsh reflections on glass and water.", usage: "Paint reflections." },
      { id: "heal-glare", icon: SunMoon, label: "Glare Cut", shortcut: "8", description: "Cut lens glare hot spots.", usage: "Paint glare." },
      { id: "heal-shadow-lift", icon: TrendingUpDown, label: "Shadow Lift", shortcut: "8", description: "Lift crushed shadows with soft fill.", usage: "Paint dark shadows." },
      { id: "heal-fog-cut", icon: CloudLightning, label: "Fog Cut", shortcut: "8", description: "Cut light fog and haze locally.", usage: "Paint foggy areas." },
      { id: "heal-grain-match", icon: WheatOff, label: "Grain Match", shortcut: "8", description: "Match grain between patched areas.", usage: "Paint patched grain." },
      { id: "heal-texture-copy", icon: CopyCheck, label: "Texture Copy", shortcut: "J", description: "Copy clean texture over damage.", usage: "Paint damaged texture." },
      { id: "heal-fabric", icon: WashingMachine, label: "Fabric Smooth", shortcut: "8", description: "Smooth fabric wrinkles, keep weave.", usage: "Paint wrinkles." },
      { id: "heal-glass", icon: Wine, label: "Glass Clean", shortcut: "8", description: "Clean glass smudges without streaks.", usage: "Paint smudges." },
      { id: "heal-chrome", icon: Bike, label: "Chrome Polish", shortcut: "8", description: "Polish chrome without warping reflections.", usage: "Paint chrome." },
      { id: "heal-rust-spot", icon: Anchor, label: "Rust Neutralize", shortcut: "8", description: "Neutralize rust spots on metal.", usage: "Paint rust spots." },
    ],
  },
  {
    id: "stamp",
    label: "Stamp",
    icon: Stamp,
    shortcut: "S",
    description: "Clone, mirror, pattern and history painting.",
    tools: [
      { id: "clone", icon: ClipboardCopy, label: "Clone Stamp", shortcut: "S", description: "Alt-click source, paint exact copies.", usage: "Alt-click source, then paint." },
      { id: "clone-mirror", icon: FlipHorizontal, label: "Mirror Clone", shortcut: "7", description: "Alt source, mirrored copy.", usage: "Alt-click, paint mirrored." },
      { id: "clone-rotate", icon: RotateCcw, label: "Rotate Clone", shortcut: "7", description: "Alt source, 90deg rotated copy.", usage: "Alt-click, paint rotated." },
      { id: "pattern-stamp", icon: LayoutTemplate, label: "Pattern Stamp", shortcut: "S", description: "Paint with active pattern.", usage: "Paint with pattern." },
      { id: "pattern-fill", icon: PaintBucket, label: "Pattern Fill", shortcut: "7", description: "Click to fill layer with pattern.", usage: "Click to fill." },
      { id: "texture-stamp", icon: Wallpaper, label: "Texture Stamp", shortcut: "7", description: "Grain weave stamp.", usage: "Paint texture." },
      { id: "history-brush", icon: History, label: "History Brush", shortcut: "Y", description: "Restore from history snapshot.", usage: "Paint to restore." },
      { id: "art-history-brush", icon: Redo2, label: "Art History Brush", shortcut: "Y", description: "Artistic stylized history strokes.", usage: "Paint for artistic effect." },
      { id: "clone-soft", icon: CopyPlus, label: "Soft Clone", shortcut: "S", description: "Manual soft 60 percent clone.", usage: "Alt-click source, paint soft." },
      { id: "pattern-dots", icon: GripVertical, label: "Dots Pattern", shortcut: "S", description: "Manual dots pattern stamp.", usage: "Paint dots pattern." },
    ],
  },
  {
    id: "tone",
    label: "Tone",
    icon: Sun,
    shortcut: "O",
    description: "Dodge, burn, light grading and manual color.",
    tools: [
      { id: "dodge", icon: LampFloor, label: "Dodge", shortcut: "O", description: "Lighten locally with soft buildup.", usage: "Paint to lighten." },
      { id: "burn", icon: Moon, label: "Burn", shortcut: "O", description: "Darken locally with soft buildup.", usage: "Paint to darken." },
      { id: "sponge", icon: ShowerHead, label: "Sponge", shortcut: "O", description: "Local saturation control.", usage: "Paint to saturate / desaturate." },
      { id: "vibrance-brush", icon: Grape, label: "Vibrance Brush", shortcut: "O", description: "Smart saturation protecting skin tones.", usage: "Paint to boost muted colors." },
      { id: "light-highlights", icon: Sunrise, label: "Highlights", shortcut: "K", description: "Lift only bright tones.", usage: "Paint over highlights." },
      { id: "light-shadows", icon: Sunset, label: "Shadows", shortcut: "K", description: "Open only dark tones.", usage: "Paint over shadows." },
      { id: "light-temp", icon: Thermometer, label: "Temperature", shortcut: "K", description: "Warm/cool local white balance.", usage: "Paint to warm." },
      { id: "light-tint", icon: FlaskRound, label: "Tint", shortcut: "K", description: "Green-magenta local tint.", usage: "Paint to tint." },
      { id: "light-clarity", icon: SunMedium, label: "Clarity", shortcut: "K", description: "Midtone local contrast.", usage: "Paint for clarity." },
      { id: "light-dehaze", icon: WavesLadder, label: "Dehaze", shortcut: "K", description: "Cut haze, deepen blacks.", usage: "Paint to dehaze." },
      { id: "light-saturate", icon: Rainbow, label: "Saturate", shortcut: "K", description: "Boost local saturation.", usage: "Paint to saturate." },
      { id: "light-levels", icon: SlidersVertical, label: "Levels Brush", shortcut: "K", description: "Stretch local levels.", usage: "Paint to expand tone." },
      { id: "dodge-high", icon: ArrowUp, label: "Dodge Highlights", shortcut: "O", description: "Manual lighten bright tones only.", usage: "Paint highlights." },
      { id: "burn-shadow", icon: MoonStar, label: "Burn Shadows", shortcut: "O", description: "Manual darken deep tones only.", usage: "Paint shadows." },
      { id: "sponge-sat", icon: BadgePlus, label: "Sponge Saturate", shortcut: "O", description: "Manual local saturate boost.", usage: "Paint to saturate." },
      { id: "sponge-desat", icon: SquareMinus, label: "Sponge Desaturate", shortcut: "O", description: "Manual local muted wash.", usage: "Paint to desaturate." },
      { id: "dodge-mid", icon: LampDesk, label: "Dodge Midtones", shortcut: "O", description: "Lift midtones without blowing highlights.", usage: "Paint midtones." },
      { id: "dodge-detail", icon: ScanEye, label: "Dodge Detail", shortcut: "O", description: "Micro lift for fine highlight detail.", usage: "Paint fine highlights." },
      { id: "burn-edge", icon: SquareArrowDown, label: "Burn Edges", shortcut: "O", description: "Darken edges for a natural vignette.", usage: "Paint photo edges." },
      { id: "burn-depth", icon: TrendingDown, label: "Burn Depth", shortcut: "O", description: "Deepen shadows for extra depth.", usage: "Paint deep shadows." },
      { id: "sponge-warm", icon: Flame, label: "Sponge Warm", shortcut: "O", description: "Push saturation toward warm hues.", usage: "Paint to warm." },
      { id: "sponge-cool", icon: SunSnow, label: "Sponge Cool", shortcut: "O", description: "Push saturation toward cool hues.", usage: "Paint to cool." },
      { id: "vibrance-skin", icon: UserRound, label: "Vibrance Skin", shortcut: "K", description: "Vibrance tuned to protect skin.", usage: "Paint skin areas." },
      { id: "vibrance-foliage", icon: TreePine, label: "Vibrance Foliage", shortcut: "K", description: "Vibrance tuned for rich foliage.", usage: "Paint foliage." },
      { id: "temp-sunset", icon: Palmtree, label: "Sunset Warmth", shortcut: "K", description: "Golden sunset white balance wash.", usage: "Paint for sunset." },
      { id: "temp-arctic", icon: ThermometerSnowflake, label: "Arctic Cool", shortcut: "K", description: "Cold arctic white balance wash.", usage: "Paint for arctic." },
      { id: "tint-cinema", icon: Popcorn, label: "Cinema Tint", shortcut: "K", description: "Cinematic green-magenta tint grade.", usage: "Paint for cinema." },
      { id: "clarity-skin", icon: Vegan, label: "Skin Clarity", shortcut: "K", description: "Negative clarity to soften skin gently.", usage: "Paint skin." },
      { id: "clarity-detail", icon: Microscope, label: "Detail Clarity", shortcut: "K", description: "Positive clarity for crisp detail.", usage: "Paint details." },
      { id: "dehaze-sky", icon: Umbrella, label: "Sky Dehaze", shortcut: "K", description: "Dehaze tuned for deep blue skies.", usage: "Paint hazy sky." },
      { id: "dehaze-portrait", icon: ContactRound, label: "Portrait Dehaze", shortcut: "K", description: "Gentle dehaze that flatters faces.", usage: "Paint portraits." },
      { id: "grain-push", icon: ChartLine, label: "Grain Push", shortcut: "K", description: "Add contrast grain for punch.", usage: "Paint for punch." },
      { id: "grain-pull", icon: ArrowDownToDot, label: "Grain Pull", shortcut: "K", description: "Pull grain back for a clean matte.", usage: "Paint for matte." },
      { id: "fade-blacks", icon: ArrowUpFromLine, label: "Fade Blacks", shortcut: "K", description: "Lift blacks for a faded film matte.", usage: "Paint dark areas." },
      { id: "fade-whites", icon: CloudOff, label: "Fade Whites", shortcut: "K", description: "Soften whites for a dreamy matte.", usage: "Paint bright areas." },
      { id: "split-gold", icon: Vault, label: "Gold Split Tone", shortcut: "K", description: "Gold and blue split tone grade.", usage: "Paint for gold grade." },
    ],
  },
  {
    id: "detail",
    label: "Detail",
    icon: Droplets,
    shortcut: "R",
    description: "Blur, sharpen, smudge, distort and denoise.",
    tools: [
      { id: "blur", icon: EyeClosed, label: "Blur", shortcut: "R", description: "Soften with radius-based blur.", usage: "Paint to soften." },
      { id: "blur-iris", icon: Aperture, label: "Iris Blur", shortcut: "R", description: "Strong center-falloff blur.", usage: "Paint for depth of field." },
      { id: "sharpen", icon: LocateFixed, label: "Sharpen", shortcut: "R", description: "Local contrast sharpening.", usage: "Paint to sharpen detail." },
      { id: "sharpen-edge", icon: ScanLine, label: "Edge Sharpen", shortcut: "R", description: "Sharpen edges only, protects flat areas.", usage: "Paint over edges." },
      { id: "smudge", icon: Fingerprint, label: "Smudge", shortcut: "R", description: "Drag pixels like wet paint.", usage: "Click to pick color, drag." },
      { id: "noise-reduction", icon: SlidersHorizontal, label: "Noise Reduction", shortcut: "R", description: "Smooth luminance noise preserving edges.", usage: "Paint over noisy areas." },
      { id: "liquify", icon: Grab, label: "Liquify", shortcut: "O", description: "Push pixels with distortion.", usage: "Drag to distort." },
      { id: "warp", icon: GitFork, label: "Warp", shortcut: "O", description: "Grid-based flexible warp.", usage: "Drag grid to bend." },
      { id: "distort-twirl", icon: RotateCw, label: "Twirl CW", shortcut: "D", description: "Rotate pixels clockwise around dab.", usage: "Hold and paint to twirl." },
      { id: "distort-twirl-ccw", icon: RotateCcwSquare, label: "Twirl CCW", shortcut: "D", description: "Rotate pixels counter-clockwise.", usage: "Paint to twirl back." },
      { id: "distort-pinch", icon: Minimize2, label: "Pinch", shortcut: "D", description: "Pull pixels toward dab center.", usage: "Paint to pinch." },
      { id: "distort-ripple", icon: Spline, label: "Ripple", shortcut: "D", description: "Sine ripple displacement.", usage: "Paint for waves." },
      { id: "distort-wave", icon: MoveHorizontal, label: "Wave", shortcut: "D", description: "Horizontal wave shift.", usage: "Paint for wave." },
      { id: "distort-zigzag", icon: Activity, label: "Zigzag", shortcut: "D", description: "Sharp zigzag offset.", usage: "Paint for zigzag." },
      { id: "distort-spherize", icon: Globe, label: "Spherize", shortcut: "D", description: "Spherical bulge magnify.", usage: "Paint to bulge." },
      { id: "distort-crystal", icon: Pyramid, label: "Crystalize", shortcut: "D", description: "Faceted mosaic crystal blocks.", usage: "Paint to crystalize." },
      { id: "detail-grain-remove", icon: ListFilter, label: "Grain Remove", shortcut: "X", description: "Smooth grain preserving edges.", usage: "Paint over grain." },
      { id: "detail-sharpen-more", icon: ChevronsUp, label: "Sharpen More", shortcut: "X", description: "Stronger edge sharpen.", usage: "Paint to sharpen hard." },
      { id: "detail-blur-more", icon: ChevronsDown, label: "Blur More", shortcut: "X", description: "Extra strong soften.", usage: "Paint to soften hard." },
      { id: "detail-tilt", icon: Building2, label: "Tilt-Shift Brush", shortcut: "X", description: "Miniature tilt blur falloff.", usage: "Paint for miniature." },
      { id: "detail-lens", icon: Disc, label: "Lens Blur", shortcut: "X", description: "Creamy circular lens blur.", usage: "Paint for bokeh." },
      { id: "detail-motion", icon: FastForward, label: "Motion Brush", shortcut: "X", description: "Directional motion streak.", usage: "Paint for motion." },
      { id: "blur-surface", icon: CloudSnow, label: "Surface Blur", shortcut: "R", description: "Manual flat-area smooth keep edges.", usage: "Paint flat areas." },
      { id: "blur-field", icon: View, label: "Field Blur", shortcut: "R", description: "Manual creamy field falloff blur.", usage: "Paint background." },
      { id: "sharpen-clarity", icon: DiamondPlus, label: "Clarity Sharp", shortcut: "R", description: "Manual midtone clarity sharpen.", usage: "Paint midtones." },
      { id: "denoise-strong", icon: ShieldCheck, label: "Denoise Strong", shortcut: "X", description: "Manual strong grain remove.", usage: "Paint noisy areas." },
      { id: "blur-tilt-strong", icon: Tent, label: "Tilt-Shift Strong", shortcut: "X", description: "Strong tilt-shift miniature blur.", usage: "Paint for miniature." },
      { id: "blur-zoom", icon: Fullscreen, label: "Zoom Blur", shortcut: "X", description: "Radial zoom burst blur.", usage: "Paint for zoom burst." },
      { id: "blur-spin", icon: LoaderPinwheel, label: "Spin Blur", shortcut: "X", description: "Radial spin blur around the dab.", usage: "Paint for spin." },
      { id: "blur-frosted", icon: Milk, label: "Frosted Blur", shortcut: "R", description: "Frosted glass blur with glow.", usage: "Paint for frosted glass." },
      { id: "blur-mosaic-soft", icon: Kanban, label: "Soft Mosaic", shortcut: "X", description: "Soft mosaic tile blur.", usage: "Paint for mosaic." },
      { id: "sharpen-halo-fix", icon: CircleCheck, label: "Halo Fix Sharpen", shortcut: "R", description: "Sharpen while fixing halo edges.", usage: "Paint halos." },
      { id: "sharpen-print", icon: Printer, label: "Print Sharpen", shortcut: "R", description: "Print tuned output sharpen.", usage: "Paint for print." },
      { id: "sharpen-screen", icon: Laptop, label: "Screen Sharpen", shortcut: "R", description: "Screen tuned crisp sharpen.", usage: "Paint for screen." },
      { id: "clarity-structure", icon: Landmark, label: "Structure Clarity", shortcut: "X", description: "Structure clarity for architecture.", usage: "Paint buildings." },
      { id: "denoise-luma", icon: Lightbulb, label: "Luma Denoise", shortcut: "X", description: "Denoise brightness grain only.", usage: "Paint luma noise." },
      { id: "denoise-chroma", icon: ListFilterPlus, label: "Chroma Denoise", shortcut: "X", description: "Denoise color blotches only.", usage: "Paint color blotches." },
      { id: "grain-35mm", icon: Projector, label: "35mm Grain", shortcut: "X", description: "Classic 35mm film grain.", usage: "Paint 35mm grain." },
      { id: "grain-120mm", icon: Clapperboard, label: "120 Grain", shortcut: "X", description: "Fine medium format grain.", usage: "Paint fine grain." },
      { id: "grain-push2", icon: ArrowBigUp, label: "Grain Push 2", shortcut: "X", description: "Pushed two stop heavy grain.", usage: "Paint heavy grain." },
      { id: "lens-swirl", icon: IterationCw, label: "Swirl Bokeh", shortcut: "X", description: "Swirly bokeh lens blur.", usage: "Paint swirl bokeh." },
      { id: "lens-bubble", icon: DiscAlbum, label: "Bubble Bokeh", shortcut: "X", description: "Bubble bokeh ring blur.", usage: "Paint bubble bokeh." },
      { id: "motion-zoom", icon: ArrowBigRight, label: "Zoom Motion", shortcut: "X", description: "Zoom streak motion blur.", usage: "Paint zoom streaks." },
      { id: "motion-spin", icon: RefreshCcw, label: "Spin Motion", shortcut: "X", description: "Circular spin motion blur.", usage: "Paint spin streaks." },
      { id: "distort-bulge", icon: Maximize2, label: "Bulge", shortcut: "D", description: "Paint to bulge pixels outward.", usage: "Paint to bulge." },
      { id: "distort-dent", icon: Minimize, label: "Dent", shortcut: "D", description: "Paint to dent pixels inward.", usage: "Paint to dent." },
      { id: "distort-squeeze", icon: FoldHorizontal, label: "Squeeze", shortcut: "D", description: "Paint to squeeze the area tighter.", usage: "Paint to squeeze." },
      { id: "distort-stretch", icon: UnfoldVertical, label: "Stretch", shortcut: "D", description: "Paint to stretch the area wider.", usage: "Paint to stretch." },
      { id: "distort-swirl-tight", icon: Loader, label: "Tight Swirl", shortcut: "D", description: "Paint a tight vortex swirl.", usage: "Paint tight swirls." },
      { id: "distort-waves-big", icon: Sailboat, label: "Big Waves", shortcut: "D", description: "Paint big rolling wave displacement.", usage: "Paint big waves." },
      { id: "distort-glass", icon: Martini, label: "Glass Refraction", shortcut: "D", description: "Paint glass refraction wobble.", usage: "Paint glass wobble." },
      { id: "distort-heat", icon: FlameKindling, label: "Heat Haze", shortcut: "D", description: "Paint heat haze shimmer.", usage: "Paint heat shimmer." },
      { id: "distort-melt", icon: ArrowDownToLine, label: "Melt", shortcut: "D", description: "Paint a downward gravity melt.", usage: "Paint drips." },
      { id: "distort-flag", icon: Milestone, label: "Flag Wave", shortcut: "D", description: "Paint a waving flag fold.", usage: "Paint flag folds." },
      { id: "distort-ripple-big", icon: LifeBuoy, label: "Big Ripple", shortcut: "D", description: "Paint large pond ripples.", usage: "Paint big ripples." },
      { id: "distort-arc-top", icon: ArrowUpToLine, label: "Arc Top", shortcut: "D", description: "Paint an upward arc bend.", usage: "Paint upward arcs." },
      { id: "distort-arc-bottom", icon: ArrowDown, label: "Arc Bottom", shortcut: "D", description: "Paint a downward arc bend.", usage: "Paint downward arcs." },
      { id: "distort-perspective", icon: Proportions, label: "Perspective Lean", shortcut: "D", description: "Paint a perspective lean, refine in Transform.", usage: "Paint perspective lean." },
    ],
  },
  {
    id: "paint",
    label: "Paint",
    icon: Droplet,
    shortcut: "G",
    description: "Gradient and fill tools.",
    tools: [
      { id: "gradient", icon: MoveDiagonal2, label: "Linear Gradient", shortcut: "G", description: "Linear blend between foreground and target.", usage: "Drag to define direction." },
      { id: "gradient-radial", icon: CircleGauge, label: "Radial Gradient", shortcut: "G", description: "Circular falloff gradient.", usage: "Drag from center outward." },
      { id: "fill", icon: Beer, label: "Paint Bucket", shortcut: "G", description: "Tolerance flood fill respecting selection.", usage: "Click area to fill." },
      { id: "fill-solid", icon: SquareStack, label: "Solid Fill", shortcut: "G", description: "Manual fill whole layer solid.", usage: "Click to fill solid." },
      { id: "fill-clear", icon: Ban, label: "Clear Fill", shortcut: "G", description: "Manual clear layer to transparent.", usage: "Click to clear." },
      { id: "gradient-diamond", icon: DiamondPercent, label: "Diamond Gradient", shortcut: "G", description: "Manual diagonal diamond gradient.", usage: "Click for diagonal blend." },
      { id: "gradient-conic", icon: Disc3, label: "Conic Gradient", shortcut: "G", description: "Angular sweep blend around click.", usage: "Click for conic sweep." },
      { id: "gradient-diamond-soft", icon: DiamondMinus, label: "Soft Diamond", shortcut: "G", description: "Soft feathered diamond blend.", usage: "Click for soft diamond." },
      { id: "gradient-reflected", icon: FlipVertical, label: "Mirror Gradient", shortcut: "G", description: "Mirrored both sides blend.", usage: "Drag for mirror blend." },
      { id: "gradient-noise", icon: Tv, label: "Noise Gradient", shortcut: "G", description: "Dithered anti-banding blend.", usage: "Click for grain blend." },
      { id: "gradient-fg-transparent", icon: MilkOff, label: "FG Transparent", shortcut: "G", description: "Foreground to transparent preset.", usage: "Click, then drag gradient." },
      { id: "fill-foreground", icon: TestTube, label: "FG Fill", shortcut: "G", description: "Fill with the foreground color.", usage: "Click to fill FG." },
      { id: "fill-background", icon: SquareMenu, label: "BG Fill", shortcut: "G", description: "Fill with the background color.", usage: "Click to fill BG." },
      { id: "fill-pattern-new", icon: Package, label: "Motif Fill", shortcut: "G", description: "Fill with the motif picker pattern.", usage: "Click to fill motif." },
      { id: "fill-content-click", icon: ClipboardPaste, label: "Content Fill Click", shortcut: "G", description: "One click content aware fill.", usage: "Click to content fill." },
      { id: "fill-history-click", icon: Clock, label: "History Fill Click", shortcut: "G", description: "One click fill from history state.", usage: "Click to history fill." },
      { id: "fill-transparent-protect", icon: Shield, label: "Protect Fill", shortcut: "G", description: "Fill that never touches transparency.", usage: "Click to safe fill." },
      { id: "bucket-contiguous", icon: Container, label: "Contiguous Fill", shortcut: "G", description: "Flood fill connected pixels only.", usage: "Click to flood neighbors." },
      { id: "bucket-global", icon: Earth, label: "Global Fill", shortcut: "G", description: "Fill every similar color in layer.", usage: "Click to fill global." },
    ],
  },
  {
    id: "vector",
    label: "Vector",
    icon: PenTool,
    shortcut: "P",
    description: "Pen paths and lines.",
    tools: [
      { id: "pen", icon: Signpost, label: "Pen", shortcut: "P", description: "Free bezier path.", usage: "Drag for free path." },
      { id: "curvature-pen", icon: GitBranch, label: "Curvature Pen", shortcut: "P", description: "Click curve points with handles.", usage: "Click points, drag handles." },
      { id: "line", icon: SeparatorHorizontal, label: "Line", shortcut: "P", description: "Straight line. Shift locks 45 degrees.", usage: "Drag for straight line." },
      { id: "pen-free", icon: RouteOff, label: "Freeform Pen", shortcut: "P", description: "Manual freehand thin ink line.", usage: "Drag freehand line." },
      { id: "line-arrow", icon: ArrowRight, label: "Arrow Line", shortcut: "P", description: "Manual line with arrow head.", usage: "Drag for arrow line." },
      { id: "pen-thin", icon: Underline, label: "Pen Thin", shortcut: "P", description: "Thin precise pen line preset.", usage: "Drag thin lines." },
      { id: "pen-medium", icon: Strikethrough, label: "Pen Medium", shortcut: "P", description: "Medium pen line preset.", usage: "Drag medium lines." },
      { id: "pen-bold", icon: Bold, label: "Pen Bold", shortcut: "P", description: "Bold pen line preset.", usage: "Drag bold lines." },
      { id: "pen-dashed", icon: Route, label: "Pen Dashed", shortcut: "P", description: "Dashed pen line for guides.", usage: "Drag dashed lines." },
      { id: "pen-arrow-both", icon: ArrowLeftRight, label: "Double Arrow", shortcut: "P", description: "Line with heads on both ends.", usage: "Drag double arrows." },
      { id: "pen-glow", icon: Torus, label: "Glow Pen", shortcut: "P", description: "Pen line with soft glow halo.", usage: "Drag glowing lines." },
    ],
  },
  {
    id: "type",
    label: "Type",
    icon: Type,
    shortcut: "T",
    description: "Horizontal, vertical and FX text.",
    tools: [
      { id: "text", icon: Text, label: "Horizontal Type", shortcut: "T", description: "Click canvas to type horizontally.", usage: "Click empty canvas to create. Click existing text to select, then drag to move and use handles to scale or rotate." },
      { id: "text-vertical", icon: MoveVertical, label: "Vertical Type", shortcut: "T", description: "Vertical CJK-style text flow.", usage: "Click empty canvas to create. Click existing text to select, then drag to move and use handles to scale or rotate." },
      { id: "text-outline", icon: TypeOutline, label: "Outline Type", shortcut: "9", description: "Hollow outline text layer.", usage: "Click empty canvas to create. Click existing text to select, then drag to move and use handles to scale or rotate." },
      { id: "text-glow", icon: Baseline, label: "Glow Type", shortcut: "9", description: "Soft glow text layer.", usage: "Click empty canvas to create. Click existing text to select, then drag to move and use handles to scale or rotate." },
      { id: "text-shadow", icon: CopyX, label: "Shadow Type", shortcut: "9", description: "Hard drop-shadow text.", usage: "Click empty canvas to create. Click existing text to select, then drag to move and use handles to scale or rotate." },
      { id: "text-arc", icon: RotateCwSquare, label: "Arc Type", shortcut: "9", description: "Arched banner text.", usage: "Click empty canvas to create. Click existing text to select, then drag to move and use handles to scale or rotate." },
      { id: "text-3d", icon: Boxes, label: "3D Type", shortcut: "T", description: "Manual extruded 3D stack text.", usage: "Click empty canvas to create. Click existing text to select, then drag to move and use handles to scale or rotate." },
      { id: "text-neon", icon: LampCeiling, label: "Neon Type", shortcut: "T", description: "Manual neon tube glow text.", usage: "Click empty canvas to create. Click existing text to select, then drag to move and use handles to scale or rotate." },
      { id: "text-gradient", icon: ALargeSmall, label: "Gradient Type", shortcut: "T", description: "Manual diagonal gradient fill text.", usage: "Click empty canvas to create. Click existing text to select, then drag to move and use handles to scale or rotate." },
      { id: "text-typewriter", icon: Keyboard, label: "Typewriter", shortcut: "T", description: "Monospace typewriter text.", usage: "Click empty canvas to create. Click existing text to select, then drag to move and use handles to scale or rotate." },
      { id: "text-blocky", icon: ToyBrick, label: "Blocky Type", shortcut: "9", description: "Chunky pixel block text.", usage: "Click empty canvas to create. Click existing text to select, then drag to move and use handles to scale or rotate." },
      { id: "text-condensed", icon: FoldVertical, label: "Condensed Type", shortcut: "9", description: "Narrow condensed text.", usage: "Click empty canvas to create. Click existing text to select, then drag to move and use handles to scale or rotate." },
      { id: "text-expanded", icon: WholeWord, label: "Expanded Type", shortcut: "9", description: "Wide expanded text.", usage: "Click empty canvas to create. Click existing text to select, then drag to move and use handles to scale or rotate." },
      { id: "text-emboss", icon: Award, label: "Emboss Type", shortcut: "9", description: "Embossed relief text.", usage: "Click empty canvas to create. Click existing text to select, then drag to move and use handles to scale or rotate." },
      { id: "text-engrave", icon: Pilcrow, label: "Engrave Type", shortcut: "9", description: "Engraved inset text.", usage: "Click empty canvas to create. Click existing text to select, then drag to move and use handles to scale or rotate." },
      { id: "text-chrome", icon: SwatchBook, label: "Chrome Type", shortcut: "9", description: "Metallic chrome text.", usage: "Click empty canvas to create. Click existing text to select, then drag to move and use handles to scale or rotate." },
      { id: "text-fire", icon: FireExtinguisher, label: "Fire Type", shortcut: "9", description: "Burning fire text.", usage: "Click empty canvas to create. Click existing text to select, then drag to move and use handles to scale or rotate." },
      { id: "text-ice", icon: IceCreamBowl, label: "Ice Type", shortcut: "9", description: "Frozen ice text.", usage: "Click empty canvas to create. Click existing text to select, then drag to move and use handles to scale or rotate." },
      { id: "text-retro", icon: CassetteTape, label: "Retro Type", shortcut: "9", description: "Double offset retro text.", usage: "Click empty canvas to create. Click existing text to select, then drag to move and use handles to scale or rotate." },
    ],
  },
  {
    id: "shape",
    label: "Shape",
    icon: Square,
    shortcut: "U",
    description: "Vector shapes with full controls, 14 variants.",
    tools: [
      { id: "shape-rect", icon: RectangleEllipsis, label: "Rectangle", shortcut: "U", description: "Rectangle. Shift = square.", usage: "Drag to draw." },
      { id: "shape-ellipse", icon: EggFried, label: "Ellipse", shortcut: "U", description: "Oval. Shift = circle.", usage: "Drag to draw." },
      { id: "triangle-shape", icon: Navigation, label: "Triangle", shortcut: "U", description: "Three-point triangle.", usage: "Drag to draw." },
      { id: "shape-polygon", icon: Shapes, label: "Polygon", shortcut: "U", description: "Multi-side polygon.", usage: "Drag to draw." },
      { id: "shape-line", icon: Equal, label: "Shape Line", shortcut: "U", description: "Vector line shape.", usage: "Drag to draw." },
      { id: "shape-star", icon: BadgeCent, label: "Star", shortcut: "U", description: "5-point vector star.", usage: "Drag to draw." },
      { id: "shape-arrow", icon: SquareArrowRight, label: "Arrow", shortcut: "U", description: "Block arrow shape.", usage: "Drag to draw." },
      { id: "shape-custom", icon: Puzzle, label: "Custom Shape", shortcut: "U", description: "Decorative custom shape.", usage: "Drag to draw." },
      { id: "shape-rounded", icon: AppWindow, label: "Rounded Rect", shortcut: "W", description: "Rectangle with round corners.", usage: "Drag to draw." },
      { id: "shape-diamond", icon: SquareArrowUpRight, label: "Diamond", shortcut: "W", description: "Four-point diamond.", usage: "Drag to draw." },
      { id: "shape-heart", icon: Heart, label: "Heart", shortcut: "W", description: "Bezier heart shape.", usage: "Drag to draw." },
      { id: "shape-hexagon", icon: OctagonMinus, label: "Hexagon", shortcut: "W", description: "Six-side hexagon.", usage: "Drag to draw." },
      { id: "shape-burst", icon: Bomb, label: "Burst", shortcut: "W", description: "12-spike starburst seal.", usage: "Drag to draw." },
      { id: "shape-donut", icon: Donut, label: "Donut", shortcut: "W", description: "Ring with transparent hole.", usage: "Drag to draw." },
      { id: "shape-chevron", icon: ChevronsRight, label: "Chevron", shortcut: "U", description: "Manual bold chevron arrow.", usage: "Drag to draw." },
      { id: "shape-moon", icon: CloudMoonRain, label: "Moon", shortcut: "U", description: "Manual crescent moon.", usage: "Drag to draw." },
      { id: "shape-cross", icon: Cross, label: "Cross", shortcut: "U", description: "Manual rounded cross badge.", usage: "Drag to draw." },
      { id: "shape-plus", icon: TicketPlus, label: "Plus", shortcut: "U", description: "Manual medical plus sign.", usage: "Drag to draw." },
      { id: "shape-trapezoid", icon: SquareSplitHorizontal, label: "Trapezoid", shortcut: "U", description: "Manual perspective trapezoid.", usage: "Drag to draw." },
      { id: "shape-trapezoid-wide", icon: Flag, label: "Wide Trapezoid", shortcut: "U", description: "Wide trapezoid banner shape.", usage: "Drag to draw." },
      { id: "shape-parallelogram", icon: SquareSplitVertical, label: "Parallelogram", shortcut: "U", description: "Slanted parallelogram shape.", usage: "Drag to draw." },
      { id: "shape-pentagon", icon: Pentagon, label: "Pentagon", shortcut: "U", description: "Five sided pentagon shape.", usage: "Drag to draw." },
      { id: "shape-octagon", icon: Octagon, label: "Octagon", shortcut: "U", description: "Eight sided octagon shape.", usage: "Drag to draw." },
      { id: "shape-shield", icon: ShieldPlus, label: "Shield", shortcut: "U", description: "Shield badge shape.", usage: "Drag to draw." },
      { id: "shape-badge", icon: Badge, label: "Badge", shortcut: "U", description: "Round award badge shape.", usage: "Drag to draw." },
      { id: "shape-ribbon", icon: Ribbon, label: "Ribbon", shortcut: "U", description: "Award ribbon shape.", usage: "Drag to draw." },
      { id: "shape-cloud", icon: CloudSunRain, label: "Cloud", shortcut: "U", description: "Fluffy cloud shape.", usage: "Drag to draw." },
      { id: "shape-speech", icon: MessageCircle, label: "Speech Bubble", shortcut: "U", description: "Speech bubble shape.", usage: "Drag to draw." },
      { id: "shape-gear", icon: Cog, label: "Gear", shortcut: "U", description: "Gear cog shape.", usage: "Drag to draw." },
      { id: "shape-drop", icon: MapPinned, label: "Drop", shortcut: "U", description: "Water drop shape.", usage: "Drag to draw." },
      { id: "shape-leaf", icon: Leaf, label: "Leaf", shortcut: "U", description: "Leaf shape.", usage: "Drag to draw." },
      { id: "shape-lightning", icon: Plug, label: "Lightning", shortcut: "U", description: "Lightning bolt shape.", usage: "Drag to draw." },
      { id: "shape-crown", icon: Crown, label: "Crown", shortcut: "U", description: "Crown shape.", usage: "Drag to draw." },
      { id: "shape-pin", icon: Pin, label: "Map Pin", shortcut: "U", description: "Map pin shape.", usage: "Drag to draw." },
      { id: "shape-ticket", icon: Ticket, label: "Ticket", shortcut: "U", description: "Event ticket shape.", usage: "Drag to draw." },
    ],
  },
  {
    id: "navigate",
    label: "Navigate",
    icon: Hand,
    shortcut: "H",
    description: "Pan, rotate, zoom and one-click zoom presets.",
    tools: [
      { id: "hand", icon: HandCoins, label: "Hand", shortcut: "H", description: "Pan canvas. Scroll zooms.", usage: "Drag to pan." },
      { id: "pan", icon: HandHelping, label: "Pan (Alt)", shortcut: "H", description: "Alternate pan for stylus.", usage: "Drag to pan." },
      { id: "rotate-view", icon: RefreshCcwDot, label: "Rotate View", shortcut: "R", description: "Non-destructive view rotation.", usage: "Drag to rotate view." },
      { id: "zoom", icon: ZoomIn, label: "Zoom", shortcut: "Z", description: "Click zoom in, Alt-click zoom out.", usage: "Click / Alt-click." },
      { id: "zoom-fit", icon: MonitorUp, label: "Fit Screen", shortcut: "6", description: "Fit document to screen.", usage: "Click canvas to fit." },
      { id: "zoom-100", icon: Maximize, label: "100%", shortcut: "6", description: "Actual pixels.", usage: "Click for 100%." },
      { id: "zoom-200", icon: Search, label: "200%", shortcut: "6", description: "Double detail.", usage: "Click for 200%." },
      { id: "zoom-400", icon: SearchCheck, label: "400%", shortcut: "6", description: "Pixel inspection.", usage: "Click for 400%." },
      { id: "zoom-50", icon: ZoomOut, label: "50%", shortcut: "6", description: "Manual half-size overview.", usage: "Click for 50%." },
      { id: "zoom-800", icon: Telescope, label: "800%", shortcut: "6", description: "Manual pixel-perfect 8x inspect.", usage: "Click for 800%." },
      { id: "rotate-reset", icon: Compass, label: "Reset Rotate", shortcut: "H", description: "Manual one-click reset view rotation.", usage: "Click to reset 0deg." },
      { id: "zoom-marquee", icon: ScanSearch, label: "Zoom Marquee", shortcut: "Z", description: "Drag a rectangle to zoom into it.", usage: "Drag to zoom area." },
      { id: "rotate-15", icon: IterationCcw, label: "Snap 15deg", shortcut: "H", description: "Snap view rotation to 15 degrees.", usage: "Click to snap rotate." },
    ],
  },
  {
    id: "localfx",
    label: "Local FX",
    icon: Sparkles,
    shortcut: "Q",
    description: "Twelve local adjustment brushes with soft falloff.",
    tools: [
      { id: "exposure-brush", icon: LampWallUp, label: "Exposure Brush", shortcut: "Q", description: "Lift local exposure with soft falloff.", usage: "Paint to brighten." },
      { id: "warmth-brush", icon: Heater, label: "Warmth Brush", shortcut: "Q", description: "Warm local color, cool shadows stay.", usage: "Paint to warm." },
      { id: "fade-brush", icon: CircleMinus, label: "Fade Brush", shortcut: "Q", description: "Soft matte fade toward mid gray.", usage: "Paint to fade." },
      { id: "contrast-brush", icon: Gauge, label: "Contrast Brush", shortcut: "Q", description: "Local contrast around midtones.", usage: "Paint for punch." },
      { id: "posterize-brush", icon: LayoutPanelTop, label: "Posterize Brush", shortcut: "Q", description: "Four level posterize blend.", usage: "Paint for graphic tone." },
      { id: "threshold-brush", icon: ToggleLeft, label: "Threshold Brush", shortcut: "Q", description: "Local black and white snap.", usage: "Paint for graphic ink." },
      { id: "hue-brush", icon: RefreshCw, label: "Hue Brush", shortcut: "Q", description: "Rotate local hue gently.", usage: "Paint to shift hue." },
      { id: "invert-brush", icon: Shuffle, label: "Invert Brush", shortcut: "Q", description: "Local invert blend for drama.", usage: "Paint to invert." },
      { id: "desat-brush", icon: CircleOff, label: "Desaturate Brush", shortcut: "Q", description: "Pull local saturation out.", usage: "Paint to mute color." },
      { id: "grain-brush", icon: Videotape, label: "Grain Brush", shortcut: "Q", description: "Add fine deterministic film grain.", usage: "Paint for texture." },
      { id: "pixelate-brush", icon: Grid2x2X, label: "Pixelate Brush", shortcut: "Q", description: "Local mosaic for privacy or style.", usage: "Paint to pixelate." },
      { id: "vignette-brush", icon: Eclipse, label: "Vignette Brush", shortcut: "Q", description: "Darken dab edges like a lens.", usage: "Paint to vignette." },
      { id: "sepia-brush", icon: Coffee, label: "Sepia Brush", shortcut: "Q", description: "Manual warm sepia tone wash.", usage: "Paint for sepia." },
      { id: "bw-brush", icon: CircleSlash, label: "B&W Brush", shortcut: "Q", description: "Manual clean black-white convert.", usage: "Paint for mono." },
      { id: "film-fade", icon: Film, label: "Film Fade", shortcut: "Q", description: "Manual lifted film matte fade.", usage: "Paint for film look." },
      { id: "split-tone", icon: Split, label: "Split Tone", shortcut: "Q", description: "Manual cool shadows warm highlights.", usage: "Paint for split tone." },
      { id: "hdr-brush", icon: BicepsFlexed, label: "HDR Brush", shortcut: "Q", description: "Manual punchy HDR micro-contrast.", usage: "Paint for HDR pop." },
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

// Cross-family usability: every sub-tool is globally selectable and functional
// from any family context. setTool() is global (zustand), dispatch/topBar/hint
// resolve by ToolId (not by active family), shortcuts cycle across families
// sharing the same letter, and search/palette list all families.
// These helpers prove and enforce that contract.
export const ALL_TOOL_IDS: string[] = TOOL_FAMILIES.flatMap((f) => f.tools.map((t) => t.id));

export const FAMILY_TOOL_IDS: Record<string, string[]> = Object.fromEntries(
  TOOL_FAMILIES.map((f) => [f.id, f.tools.map((t) => t.id)]),
);

export function isToolUsableAcrossFamilies(toolId: string): boolean {
  return toolId in TOOL_MAP;
}

export function toolsUsableAcrossFamilies(): string[] {
  return [...ALL_TOOL_IDS];
}

export function familyOfTool(toolId: string): string | null {
  return FAMILY_OF[toolId] ?? null;
}

// Global icon uniqueness: 18 family headers + 488 sub-tools (416 explicit +
// 72 stickers) must all use distinct lucide components. Vector art is the
// primary sticker visual; icon is the fallback mark and must still be unique.
export function allIconsGloballyUnique(): { ok: boolean; dupes: string[] } {
  const seen = new Map<unknown, string>();
  const dupes: string[] = [];
  for (const f of TOOL_FAMILIES) {
    if (seen.has(f.icon)) dupes.push(`family:${f.id} == ${seen.get(f.icon)}`);
    else seen.set(f.icon, `family:${f.id}`);
    for (const t of f.tools) {
      if (seen.has(t.icon)) dupes.push(`${f.id}/${t.id} == ${seen.get(t.icon)}`);
      else seen.set(t.icon, `${f.id}/${t.id}`);
    }
  }
  return { ok: dupes.length === 0, dupes };
}

// Sticker sub picker: grouped grid view (not a list), one vector thumb per
// sticker painted live in the brush color. Shared by the sidebar panel and
// the flyout.
function StickerArtThumb({ id, color }: { id: string; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const S = 44;
    el.width = S;
    el.height = S;
    const g = el.getContext("2d");
    if (!g) return;
    const meta = STICKER_BY_ID[id];
    if (!meta) return;
    paintStickerArt(g, { shapes: meta.art, fx: meta.fx }, color, S);
  }, [id, color]);
  return <canvas ref={ref} className="h-[26px] w-[26px]" aria-hidden="true" />;
}

function StickerGrid({
  tools,
  activeId,
  onPick,
  columns,
}: {
  tools: ToolDef[];
  activeId: string;
  onPick: (id: ToolId) => void;
  columns: string;
}) {
  const brushColor = useEditorStore((s) => s.brushColor);
  return (
    <div>
      {STICKER_CATEGORIES.map((c) => {
        const items = tools.filter((t) => STICKER_BY_ID[t.id]?.category === c.id);
        if (items.length === 0) return null;
        return (
          <div key={c.id} className="mb-2">
            <div className="mb-1 flex items-center gap-1.5 px-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6e6e78]">
                {c.label}
              </span>
              <span className="rounded border border-[#2c2c31] bg-[#101012] px-1 font-mono text-[9px] text-[#a7a7b0]">
                {items.length}
              </span>
            </div>
            <div className={`grid ${columns} gap-1`}>
              {items.map((t) => {
                const active = activeId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => onPick(t.id)}
                    title={`${t.label} (${t.shortcut}) - ${t.description} ${t.usage}`}
                    aria-label={t.label}
                    aria-pressed={active}
                    className={clsx(
                      "avero-press grid aspect-square place-items-center rounded-md border leading-none",
                      active
                        ? "border-[#2f7cf6] bg-[#2f7cf6]/20"
                        : "border-transparent hover:border-[#2c2c31] hover:bg-[#232327]",
                    )}
                  >
                    <StickerArtThumb id={t.id} color={brushColor} />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

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
    <div className="relative flex shrink-0">
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
              aria-label={`${f.label}, shortcut ${f.shortcut}`}
              aria-pressed={active}
              onClick={() => pickFamily(f)}
              onContextMenu={(e) => {
                e.preventDefault();
                setOpenFamily(openFamily === f.id ? null : f.id);
                setExpanded(true);
              }}
              className={clsx(
                "avero-press relative grid h-9 w-9 shrink-0 place-items-center rounded-md border",
                active ? "border-[#2f7cf6] bg-[#2f7cf6] text-white" : "border-transparent text-[#a7a7b0] hover:bg-[#232327] hover:text-white",
              )}
            >
              <Icon size={16} strokeWidth={1.9} />
              <span className="pointer-events-none absolute left-[4px] top-[3px] font-mono text-[7.5px] font-semibold leading-none opacity-50">
                {f.shortcut}
              </span>
              {variantCount > 1 && (
                <span className={`absolute bottom-[3px] right-[3px] h-1 w-1 rounded-full bg-current opacity-60 ${active ? "avero-ring-pulse" : ""}`} />
              )}
            </button>
          );
        })}
        <button
          title={expanded ? "Collapse tool panel" : "Expand tool panel with descriptions"}
          aria-label={expanded ? "Collapse tool panel" : "Expand tool panel"}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 grid h-8 w-9 place-items-center rounded-md text-[#a7a7b0] hover:bg-[#232327] hover:text-white"
        >
          {expanded ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
        </button>
        <div className="mt-auto px-1 pb-1 text-center font-mono text-[8.5px] leading-tight text-[#6e6e78]">
          Ctrl+K
        </div>
      </div>

      {/* Expandable sidebar with descriptions, search, collapsible groups.
          Floating card (Affinity-style studio flyout): canvas width stays
          stable whether the panel is open or closed. It starts right of the
          vertical ruler and below the top options bar so neither is covered. */}
      {expanded && (
        <div className="avero-slide-in absolute bottom-3 left-[74px] top-[76px] z-40 flex w-[264px] flex-col rounded-xl border border-[#2c2c31] bg-[#161618] shadow-2xl">
          <div className="flex items-center gap-2 border-b border-[#2c2c31] p-2">
            <Search size={13} className="shrink-0 text-[#6e6e78]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tools..."
              className="w-full bg-transparent text-[12px] text-white outline-none placeholder:text-[#6e6e78]"
            />
            <button
              onClick={() => setExpanded(false)}
              title="Close tool panel"
              className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[#6e6e78] hover:bg-[#232327] hover:text-white"
            >
              <ChevronLeft size={14} />
            </button>
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
                      {f.id === "sticker" ? (
                        <StickerGrid tools={f.tools} activeId={tool} onPick={setTool} columns="grid-cols-6" />
                      ) : (
                      f.tools.map((t) => {
                        const Icon = t.icon;
                        const active = tool === t.id;
                        return (
                          <button
                            key={t.id}
                            onClick={() => setTool(t.id)}
                            title={`${t.label} (${t.shortcut}) - ${t.description} ${t.usage}`}
                            className={clsx(
                              "avero-press mb-0.5 flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left",
                              active
                                ? "border-[#2f7cf6] bg-[#232327]"
                                : "border-transparent hover:border-[#2c2c31] hover:bg-[#232327]",
                            )}
                          >
                            <Icon size={14} className={clsx("shrink-0", active ? "text-white" : "text-[#a7a7b0]")} />
                            <span className={clsx("flex-1 truncate text-[12px] font-medium", active ? "text-white" : "text-[#c9c9d1]")}>
                              {t.label}
                            </span>
                            <span className="font-mono text-[9px] text-[#6e6e78]">{t.shortcut}</span>
                          </button>
                        );
                      })
                      )}
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
            {TOOL_FAMILIES.length} families, {TOOLS.length} sub-tools. Click a family icon to select. Click again to cycle variants. Right-click opens this panel.
          </div>
        </div>
      )}

      {/* Flyout for current family when sidebar closed. Same floating card
          geometry as the sidebar: clear of the ruler and the top bar. */}
      {!expanded && openFamily && (
        <div key={openFamily} className="avero-slide-in absolute bottom-3 left-[74px] top-[76px] z-40 w-[220px] overflow-y-auto rounded-xl border border-[#2c2c31] bg-[#161618] p-1.5 shadow-2xl">
          {(() => {
            const f = TOOL_FAMILIES.find((x) => x.id === openFamily);
            if (!f) return null;
            return (
              <div>
                <div className="mb-1 flex items-center gap-1.5 px-1 pt-1">
                  <span className="text-[11px] font-semibold text-white">{f.label}</span>
                  <span className="rounded border border-[#2c2c31] bg-[#101012] px-1 py-px font-mono text-[9px] text-[#a7a7b0]">{f.shortcut}</span>
                  <span className="rounded bg-[#2f7cf6] px-1 py-px font-mono text-[9px] text-white">{f.tools.length}</span>
                  <button
                    onClick={() => setOpenFamily(null)}
                    title="Close family panel"
                    className="ml-auto grid h-5 w-5 place-items-center rounded text-[#6e6e78] hover:bg-[#232327] hover:text-white"
                  >
                    <ChevronLeft size={12} />
                  </button>
                </div>
                <div className="mb-2 px-1 text-[10.5px] text-[#6e6e78]">{f.description}</div>
                {f.id === "sticker" ? (
                  <StickerGrid tools={f.tools} activeId={tool} onPick={setTool} columns="grid-cols-5" />
                ) : (
                f.tools.map((t) => {
                  const Icon = t.icon;
                  const active = tool === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTool(t.id)}
                      className={clsx(
                        "avero-press mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px]",
                        active ? "bg-[#2f7cf6] text-white" : "text-[#c9c9d1] hover:bg-[#232327]",
                      )}
                      title={`${t.label} (${t.shortcut}) - ${t.description} ${t.usage}`}
                    >
                      <Icon size={14} className="shrink-0" />
                      <span className="flex-1 truncate">{t.label}</span>
                      <span className={clsx("font-mono text-[9px]", active ? "text-white/70" : "text-[#6e6e78]")}>{t.shortcut}</span>
                    </button>
                  );
                })
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
