import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

vi.mock("./nativeEngine", () => ({
  isTauri: () => true,
  segmentModelsStatus: vi.fn(),
  segmentObjects: vi.fn(),
  segmentStuff: vi.fn(),
  segmentText: vi.fn(),
}));

vi.mock("../engine/selection", () => ({
  restoreSelectionMask: vi.fn(),
}));

vi.mock("../ui/notify", () => ({
  notify: vi.fn(),
  showError: vi.fn(),
  showMessage: vi.fn(),
}));

import { runAutoSegment } from "./autoSegment";
import { useEditorStore, makeLayer } from "../stores/useEditorStore";
import { useProStore, resetHistogramThrottle } from "../stores/useProStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import { layerManager } from "../engine/layerManager";
import { restoreSelectionMask } from "../engine/selection";
import { notify, showMessage } from "../ui/notify";
import * as nativeEngine from "./nativeEngine";

class FakeImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  constructor(w: number, _h: number) {
    this.width = w;
    this.height = _h;
    this.data = new Uint8ClampedArray(w * _h * 4);
  }
}

class FakeCtx {
  canvas: HTMLCanvasElement;
  fillStyle: string = "#000";
  globalCompositeOperation: string = "source-over";
  globalAlpha: number = 1;
  filter: string = "none";
  drawImageCalls: any[][] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  drawImage(...args: any[]) {
    this.drawImageCalls.push(args);
  }

  getImageData(_x: number, _y: number, w: number, h: number) {
    return new FakeImageData(w, h);
  }

  putImageData() {}
  fillRect() {}
  clearRect() {}
  save() {}
  restore() {}
  beginPath() {}
  closePath() {}
  fill() {}
  stroke() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  rect() {}
  clip() {}
  translate() {}
  scale() {}
  rotate() {}
  setTransform() {}
  resetTransform() {}
  measureText() {
    return { width: 0 };
  }
  fillText() {}
  strokeText() {}
  createLinearGradient() {
    return { addColorStop() {} };
  }
  createRadialGradient() {
    return { addColorStop() {} };
  }
  createPattern() {
    return null;
  }
  getLineDash() {
    return [];
  }
  setLineDash() {}
}

class FakeImage {
  onload: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  private _src: string = "";
  width: number = 10;
  height: number = 10;

  get src() {
    return this._src;
  }
  set src(v: string) {
    this._src = v;
    setTimeout(() => this.onload?.(), 0);
  }
}

function makeFakeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function setupDocument() {
  const baseLayer = makeLayer("Photo");
  useEditorStore.setState({
    doc: { name: "Test", width: 800, height: 600, filePath: null, projectPath: null, projectFolder: null, dirty: false, fileSize: null },
    layers: [baseLayer],
    activeLayerId: baseLayer.id,
    history: [],
    future: [],
    selectedLayerIds: [],
  });
  layerManager.clear();
  const comp = makeFakeCanvas(800, 600);
  (window as unknown as { __avero_comp?: HTMLCanvasElement }).__avero_comp = comp;
  return { baseLayer, comp };
}

function mockModelsFound() {
  (nativeEngine.segmentModelsStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
    yolo: { found: true, path: "C:/models/yolo11n-seg.onnx" },
    stuff: { found: true, path: "C:/models/segformer-b1-ade.onnx" },
    text: { found: true, path: "C:/models/dbnet.onnx" },
  });
}

function mockDetections() {
  (nativeEngine.segmentObjects as ReturnType<typeof vi.fn>).mockResolvedValue({
    detections: [
      { label: "bus", class_id: 5, score: 0.6, x: 10, y: 100, w: 400, h: 200, mask_png_base64: "dGVzdA==" },
      { label: "person", class_id: 0, score: 0.85, x: 500, y: 150, w: 80, h: 250, mask_png_base64: "dGVzdA==" },
    ],
    input_width: 800,
    input_height: 600,
    millis: 500,
  });
  (nativeEngine.segmentStuff as ReturnType<typeof vi.fn>).mockResolvedValue({
    regions: [
      { label: "Building", class_id: 1, coverage: 0.3, x: 0, y: 0, w: 800, h: 200, mask_png_base64: "dGVzdA==" },
    ],
    input_width: 800,
    input_height: 600,
    millis: 800,
  });
  (nativeEngine.segmentText as ReturnType<typeof vi.fn>).mockResolvedValue({
    boxes: [{ x: 100, y: 50, w: 120, h: 30, score: 0.7, mask_png_base64: "" }],
    input_width: 800,
    input_height: 600,
    millis: 300,
  });
}

describe("autoSegment e2e: detections become layers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({ segmentLabelsId: false });
    (HTMLCanvasElement.prototype as unknown as { getContext: unknown }).getContext = function (
      this: HTMLCanvasElement,
      type: string,
    ) {
      if (type === "2d") return new FakeCtx(this);
      return null;
    };
    (globalThis as unknown as { Image: unknown }).Image = FakeImage;
    useProStore.setState({ histogramTick: 0 });
  });

  afterEach(() => {
    delete (window as unknown as { __avero_comp?: HTMLCanvasElement }).__avero_comp;
  });

  it("creates one layer per detection, base untouched, no history", async () => {
    const { baseLayer } = setupDocument();
    mockModelsFound();
    mockDetections();

    const baseCanvasBefore = layerManager.get(baseLayer.id);
    const baseDrawCallsBefore = baseCanvasBefore
      ? (baseCanvasBefore.getContext("2d") as unknown as FakeCtx).drawImageCalls.length
      : 0;

    await runAutoSegment();

    const st = useEditorStore.getState();
    expect(st.layers.length).toBe(5);
    expect(st.layers.map((l) => l.name)).toContain("Bus 1");
    expect(st.layers.map((l) => l.name)).toContain("Person 1");
    expect(st.layers.map((l) => l.name)).toContain("Building 1");
    expect(st.layers.map((l) => l.name)).toContain("Text 1");
    expect(st.layers[0].id).toBe(baseLayer.id);
    expect(st.history.length).toBe(0);
    expect(st.doc.dirty).toBe(true);

    const baseCanvasAfter = layerManager.get(baseLayer.id);
    expect(baseCanvasAfter).toBe(baseCanvasBefore);
    if (baseCanvasAfter) {
      const ctx = baseCanvasAfter.getContext("2d") as unknown as FakeCtx;
      expect(ctx.drawImageCalls.length).toBe(baseDrawCallsBefore);
    }
  });

  it("selects biggest object and creates selection mask", async () => {
    setupDocument();
    mockModelsFound();
    mockDetections();

    await runAutoSegment();

    const st = useEditorStore.getState();
    const buildingLayer = st.layers.find((l) => l.name === "Building 1");
    expect(buildingLayer).toBeDefined();
    expect(st.activeLayerId).toBe(buildingLayer!.id);
    expect(restoreSelectionMask).toHaveBeenCalledWith(800, 600, expect.any(HTMLCanvasElement));
  });

  it("names duplicate labels with counters", async () => {
    setupDocument();
    mockModelsFound();
    (nativeEngine.segmentObjects as ReturnType<typeof vi.fn>).mockResolvedValue({
      detections: [
        { label: "person", class_id: 0, score: 0.9, x: 10, y: 10, w: 50, h: 100, mask_png_base64: "dGVzdA==" },
        { label: "person", class_id: 0, score: 0.8, x: 200, y: 10, w: 50, h: 100, mask_png_base64: "dGVzdA==" },
        { label: "person", class_id: 0, score: 0.7, x: 400, y: 10, w: 50, h: 100, mask_png_base64: "dGVzdA==" },
      ],
      input_width: 800,
      input_height: 600,
      millis: 400,
    });
    (nativeEngine.segmentStuff as ReturnType<typeof vi.fn>).mockResolvedValue({
      regions: [],
      input_width: 800,
      input_height: 600,
      millis: 600,
    });
    (nativeEngine.segmentText as ReturnType<typeof vi.fn>).mockResolvedValue({
      boxes: [],
      input_width: 800,
      input_height: 600,
      millis: 200,
    });

    await runAutoSegment();

    const st = useEditorStore.getState();
    expect(st.layers.length).toBe(4);
    expect(st.layers.map((l) => l.name)).toEqual(["Photo", "Person 1", "Person 2", "Person 3"]);
  });

  it("handles missing models gracefully", async () => {
    setupDocument();
    (nativeEngine.segmentModelsStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      yolo: { found: false, path: "C:/models/yolo11n-seg.onnx" },
      stuff: { found: false, path: "C:/models/segformer-b1-ade.onnx" },
      text: { found: false, path: "C:/models/dbnet.onnx" },
    });

    await runAutoSegment();

    const st = useEditorStore.getState();
    expect(st.layers.length).toBe(1);
    expect(showMessage).toHaveBeenCalledWith(expect.stringContaining("No segment models found"), "Auto Segment");
  });

  it("handles empty detections", async () => {
    setupDocument();
    mockModelsFound();
    (nativeEngine.segmentObjects as ReturnType<typeof vi.fn>).mockResolvedValue({
      detections: [],
      input_width: 800,
      input_height: 600,
      millis: 400,
    });
    (nativeEngine.segmentStuff as ReturnType<typeof vi.fn>).mockResolvedValue({
      regions: [],
      input_width: 800,
      input_height: 600,
      millis: 600,
    });
    (nativeEngine.segmentText as ReturnType<typeof vi.fn>).mockResolvedValue({
      boxes: [],
      input_width: 800,
      input_height: 600,
      millis: 200,
    });

    await runAutoSegment();

    const st = useEditorStore.getState();
    expect(st.layers.length).toBe(1);
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("No objects found"));
  });

  it("skips tiny detections below area threshold", async () => {
    setupDocument();
    mockModelsFound();
    (nativeEngine.segmentObjects as ReturnType<typeof vi.fn>).mockResolvedValue({
      detections: [
        { label: "person", class_id: 0, score: 0.9, x: 10, y: 10, w: 2, h: 2, mask_png_base64: "dGVzdA==" },
        { label: "bus", class_id: 5, score: 0.8, x: 100, y: 100, w: 300, h: 150, mask_png_base64: "dGVzdA==" },
      ],
      input_width: 800,
      input_height: 600,
      millis: 400,
    });
    (nativeEngine.segmentStuff as ReturnType<typeof vi.fn>).mockResolvedValue({
      regions: [],
      input_width: 800,
      input_height: 600,
      millis: 600,
    });
    (nativeEngine.segmentText as ReturnType<typeof vi.fn>).mockResolvedValue({
      boxes: [],
      input_width: 800,
      input_height: 600,
      millis: 200,
    });

    await runAutoSegment();

    const st = useEditorStore.getState();
    expect(st.layers.length).toBe(2);
    expect(st.layers.map((l) => l.name)).toEqual(["Photo", "Bus 1"]);
  });

  it("deduplicates overlapping same-label detections", async () => {
    setupDocument();
    mockModelsFound();
    (nativeEngine.segmentObjects as ReturnType<typeof vi.fn>).mockResolvedValue({
      detections: [
        { label: "bus", class_id: 5, score: 0.9, x: 10, y: 100, w: 400, h: 200, mask_png_base64: "dGVzdA==" },
        { label: "bus", class_id: 5, score: 0.7, x: 15, y: 105, w: 390, h: 195, mask_png_base64: "dGVzdA==" },
      ],
      input_width: 800,
      input_height: 600,
      millis: 400,
    });
    (nativeEngine.segmentStuff as ReturnType<typeof vi.fn>).mockResolvedValue({
      regions: [],
      input_width: 800,
      input_height: 600,
      millis: 600,
    });
    (nativeEngine.segmentText as ReturnType<typeof vi.fn>).mockResolvedValue({
      boxes: [],
      input_width: 800,
      input_height: 600,
      millis: 200,
    });

    await runAutoSegment();

    const st = useEditorStore.getState();
    expect(st.layers.length).toBe(2);
    expect(st.layers.map((l) => l.name)).toEqual(["Photo", "Bus 1"]);
  });

  it("does not dedupe different-label overlapping detections", async () => {
    setupDocument();
    mockModelsFound();
    (nativeEngine.segmentObjects as ReturnType<typeof vi.fn>).mockResolvedValue({
      detections: [
        { label: "bus", class_id: 5, score: 0.9, x: 10, y: 100, w: 400, h: 200, mask_png_base64: "dGVzdA==" },
        { label: "truck", class_id: 7, score: 0.8, x: 15, y: 105, w: 390, h: 195, mask_png_base64: "dGVzdA==" },
      ],
      input_width: 800,
      input_height: 600,
      millis: 400,
    });
    (nativeEngine.segmentStuff as ReturnType<typeof vi.fn>).mockResolvedValue({
      regions: [],
      input_width: 800,
      input_height: 600,
      millis: 600,
    });
    (nativeEngine.segmentText as ReturnType<typeof vi.fn>).mockResolvedValue({
      boxes: [],
      input_width: 800,
      input_height: 600,
      millis: 200,
    });

    await runAutoSegment();

    const st = useEditorStore.getState();
    expect(st.layers.length).toBe(3);
    expect(st.layers.map((l) => l.name)).toContain("Bus 1");
    expect(st.layers.map((l) => l.name)).toContain("Truck 1");
  });

  it("marks doc dirty and bumps histogram", async () => {
    setupDocument();
    mockModelsFound();
    mockDetections();
    resetHistogramThrottle();

    const tickBefore = useProStore.getState().histogramTick;
    await runAutoSegment();

    const st = useEditorStore.getState();
    expect(st.doc.dirty).toBe(true);
    expect(useProStore.getState().histogramTick).toBeGreaterThan(tickBefore);
  });

  it("notifies with correct counts", async () => {
    setupDocument();
    mockModelsFound();
    mockDetections();

    await runAutoSegment();

    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining("Segmented 4 objects (2 things, 1 regions, 1 text)"),
    );
  });

  it("preserves the photo flag on the base layer", async () => {
    const { baseLayer } = setupDocument();
    layerManager.markPhoto(baseLayer.id);
    mockModelsFound();
    mockDetections();

    await runAutoSegment();

    expect(layerManager.isPhotoLayer(baseLayer.id)).toBe(true);
  });

  it("keeps base layer canvas object identical (no pixel mutation)", async () => {
    const { baseLayer } = setupDocument();
    mockModelsFound();
    mockDetections();

    const before = layerManager.get(baseLayer.id);
    await runAutoSegment();
    const after = layerManager.get(baseLayer.id);

    expect(after).toBe(before);
  });

  it("uses Indonesian layer names when segmentLabelsId is enabled", async () => {
    setupDocument();
    useSettingsStore.setState({ segmentLabelsId: true });
    mockModelsFound();
    (nativeEngine.segmentObjects as ReturnType<typeof vi.fn>).mockResolvedValue({
      detections: [
        { label: "bus", class_id: 5, score: 0.9, x: 10, y: 100, w: 400, h: 200, mask_png_base64: "dGVzdA==" },
        { label: "person", class_id: 0, score: 0.8, x: 500, y: 150, w: 80, h: 250, mask_png_base64: "dGVzdA==" },
      ],
      input_width: 800,
      input_height: 600,
      millis: 400,
    });
    (nativeEngine.segmentStuff as ReturnType<typeof vi.fn>).mockResolvedValue({
      regions: [{ label: "house", class_id: 25, coverage: 0.4, x: 0, y: 0, w: 800, h: 300, mask_png_base64: "dGVzdA==" }],
      input_width: 800,
      input_height: 600,
      millis: 600,
    });
    (nativeEngine.segmentText as ReturnType<typeof vi.fn>).mockResolvedValue({
      boxes: [{ x: 100, y: 50, w: 120, h: 30, score: 0.7, mask_png_base64: "" }],
      input_width: 800,
      input_height: 600,
      millis: 200,
    });

    await runAutoSegment();

    const st = useEditorStore.getState();
    expect(st.layers.map((l) => l.name)).toContain("Bus 1");
    expect(st.layers.map((l) => l.name)).toContain("Orang 1");
    expect(st.layers.map((l) => l.name)).toContain("Rumah 1");
    expect(st.layers.map((l) => l.name)).toContain("Tulisan 1");
    useSettingsStore.setState({ segmentLabelsId: false });
  });

  it("writes the biggest object mask to the selection", async () => {
    setupDocument();
    mockModelsFound();
    mockDetections();

    await runAutoSegment();

    const st = useEditorStore.getState();
    const building = st.layers.find((l) => l.name === "Building 1");
    expect(building).toBeDefined();
    expect(st.activeLayerId).toBe(building!.id);
    expect(restoreSelectionMask).toHaveBeenCalledWith(800, 600, expect.any(HTMLCanvasElement));
  });
});
