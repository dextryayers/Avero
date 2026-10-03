import { describe, it, expect, beforeEach } from "vitest";
import { useObjectStore } from "./useObjectStore";

describe("useObjectStore (plan5 Fase 7)", () => {
  beforeEach(() => {
    useObjectStore.getState().clearObjects();
  });

  it("adds and lists objects", () => {
    const st = useObjectStore.getState();
    st.addObject({ id: "o1", layerId: "l1", label: "Bus", confidence: 0.9, thumb: null, source: "yolo" });
    st.addObject({ id: "o2", layerId: "l2", label: "House", confidence: 0.7, thumb: "data:image/png;base64,x", source: "stuff" });
    expect(useObjectStore.getState().objects.length).toBe(2);
  });

  it("selects and deselects", () => {
    const st = useObjectStore.getState();
    st.addObject({ id: "o1", layerId: "l1", label: "Bus", confidence: 0.9, thumb: null, source: "yolo" });
    st.selectObject("o1");
    expect(useObjectStore.getState().selectedId).toBe("o1");
    st.selectObject(null);
    expect(useObjectStore.getState().selectedId).toBeNull();
  });

  it("removes one entry and clears the selection when it was selected", () => {
    const st = useObjectStore.getState();
    st.addObject({ id: "o1", layerId: "l1", label: "Bus", confidence: 0.9, thumb: null, source: "yolo" });
    st.selectObject("o1");
    st.removeObject("o1");
    expect(useObjectStore.getState().objects.length).toBe(0);
    expect(useObjectStore.getState().selectedId).toBeNull();
  });
});
