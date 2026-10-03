import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

vi.mock("./nativeEngine", () => ({
  isTauri: () => true,
  segmentModelsStatus: vi.fn(),
}));

vi.mock("./autoSegment", () => ({
  runAutoSegment: vi.fn(),
}));

import { triggerAutoSegment, cancelPendingAutoSegment } from "./autoSegmentTrigger";
import { useSettingsStore } from "../stores/useSettingsStore";
import { segmentModelsStatus } from "./nativeEngine";
import { runAutoSegment } from "./autoSegment";

describe("autoSegmentTrigger (plan5 Fase 6.1)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    cancelPendingAutoSegment();
    useSettingsStore.setState({ autoSegment: true });
    (segmentModelsStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      yolo: { found: true, path: "yolo.onnx" },
      stuff: { found: false, path: "stuff.onnx" },
      text: { found: false, path: "text.onnx" },
    });
  });

  afterEach(() => {
    cancelPendingAutoSegment();
    vi.useRealTimers();
  });

  it("does nothing when autoSegment is disabled", async () => {
    useSettingsStore.setState({ autoSegment: false });
    await triggerAutoSegment();
    await vi.advanceTimersByTimeAsync(500);
    expect(runAutoSegment).not.toHaveBeenCalled();
  });

  it("fires runAutoSegment after the debounce when models exist", async () => {
    await triggerAutoSegment();
    expect(runAutoSegment).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    expect(runAutoSegment).toHaveBeenCalledTimes(1);
  });

  it("stays silent when no models are installed", async () => {
    (segmentModelsStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      yolo: { found: false, path: "yolo.onnx" },
      stuff: { found: false, path: "stuff.onnx" },
      text: { found: false, path: "text.onnx" },
    });
    await triggerAutoSegment();
    await vi.advanceTimersByTimeAsync(500);
    expect(runAutoSegment).not.toHaveBeenCalled();
  });

  it("cancelPendingAutoSegment suppresses the pending run", async () => {
    await triggerAutoSegment();
    cancelPendingAutoSegment();
    await vi.advanceTimersByTimeAsync(500);
    expect(runAutoSegment).not.toHaveBeenCalled();
  });
});
