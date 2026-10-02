import { describe, it, expect, beforeEach } from "vitest";
import { useProStore } from "./useProStore";

describe("shiftDocSpace (crop keeps annotations glued to content)", () => {
  beforeEach(() => {
    useProStore.setState({
      guidesH: [],
      guidesV: [],
      slices: [],
      activeSliceId: null,
      notes: [],
      counts: [],
      samplers: [],
      measures: [],
      paths: [],
      textSpecs: {},
    });
  });

  it("shifts guides and drops out-of-bounds ones", () => {
    useProStore.setState({ guidesH: [100, 900], guidesV: [50] });
    // crop origin (20,30), new doc 800x600
    useProStore.getState().shiftDocSpace(-20, -30, 800, 600);
    const s = useProStore.getState();
    expect(s.guidesH).toEqual([70]);
    expect(s.guidesV).toEqual([30]);
  });

  it("shifts pins and drops outside ones, keeps counts numbering", () => {
    const st = useProStore.getState();
    st.addNote({ x: 100, y: 100, text: "a" });
    st.addNote({ x: 5, y: 5, text: "gone" });
    st.addCount({ x: 200, y: 200, n: 3 });
    st.addSampler({ x: 10, y: 10, color: "#ff0000" });
    st.shiftDocSpace(-20, -30, 800, 600);
    const s = useProStore.getState();
    expect(s.notes).toHaveLength(1);
    expect(s.notes[0].x).toBe(80);
    expect(s.notes[0].y).toBe(70);
    expect(s.counts[0]).toMatchObject({ x: 180, y: 170, n: 3 });
    expect(s.samplers).toHaveLength(0);
  });

  it("shifts slices/measures/paths/text anchors", () => {
    const st = useProStore.getState();
    const sid = st.addSlice({ x: 100, y: 100, w: 50, h: 50, name: "S1" });
    st.addSlice({ x: 900, y: 900, w: 50, h: 50, name: "out" });
    st.setActiveSlice(sid);
    st.addMeasure({ x0: 0, y0: 0, x1: 100, y1: 100, label: "m" });
    const pid = st.addPath({ name: "p", kind: "line", points: [{ x: 50, y: 50 }] });
    void pid;
    st.setTextSpec("t1", {
      text: "hi",
      fontFamily: "Inter",
      fontSize: 24,
      color: "#fff",
      bold: false,
      italic: false,
      tracking: 0,
      leading: 1,
      x: 300,
      y: 300,
    });
    st.shiftDocSpace(-20, -30, 800, 600);
    const s = useProStore.getState();
    expect(s.slices).toHaveLength(1);
    expect(s.slices[0]).toMatchObject({ x: 80, y: 70 });
    expect(s.activeSliceId).toBe(sid);
    expect(s.measures[0]).toMatchObject({ x1: 80, y1: 70 });
    expect(s.paths[0].points[0]).toMatchObject({ x: 30, y: 20 });
    expect(s.textSpecs["t1"]).toMatchObject({ x: 280, y: 270 });
  });
});
