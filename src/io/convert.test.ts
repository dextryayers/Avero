import { describe, it, expect } from "vitest";
import {
  FORMAT_CARDS,
  baseOf,
  buildOutputPath,
  computeTargetSize,
  defaultSuffix,
  extOf,
  formatBytes,
  groupBy,
  effTargetOf,
  isInputSupported,
  needsMatte,
  parentOf,
  resizeInputFromSettings,
  usesQuality,
} from "./convert";
import { WEB_FORMATS, isWebInputSupported } from "./convertWeb";

describe("convert path helpers", () => {
  it("reads extensions case-insensitively", () => {
    expect(extOf("C:\\pics\\Photo.JPG")).toBe("jpg");
    expect(extOf("/home/u/a.webp")).toBe("webp");
    expect(extOf("noext")).toBe("");
  });

  it("accepts supported inputs and rejects the rest", () => {
    expect(isInputSupported("a.png")).toBe(true);
    expect(isInputSupported("a.tif")).toBe(true);
    expect(isInputSupported("a.qoi")).toBe(true);
    expect(isInputSupported("a.avx")).toBe(false);
    expect(isInputSupported("a.exe")).toBe(false);
  });

  it("strips directories and extensions for base names", () => {
    expect(baseOf("C:\\pics\\shot.png")).toBe("shot");
    expect(baseOf("/home/u/shot.jpeg")).toBe("shot");
  });

  it("builds output paths beside source by default", () => {
    expect(buildOutputPath("C:\\pics\\shot.png", null, "jpg", {})).toBe("C:\\pics\\shot.jpg");
    expect(buildOutputPath("/home/u/shot.png", "/out", "webp", { suffix: "-web" })).toBe(
      "/out/shot-web.webp",
    );
  });

  it("adds a safety suffix when the format is unchanged", () => {
    expect(defaultSuffix("a.png", "png")).toBe("-converted");
    expect(defaultSuffix("a.png", "jpg")).toBe("");
  });

  it("finds parent folders on both separators", () => {
    expect(parentOf("C:\\pics\\shot.png")).toBe("C:\\pics");
    expect(parentOf("/home/u/shot.png")).toBe("/home/u");
  });

  it("flags matte and quality applicability per format", () => {
    expect(needsMatte("jpg")).toBe(true);
    expect(needsMatte("bmp")).toBe(true);
    expect(needsMatte("png")).toBe(false);
    expect(usesQuality("jpg")).toBe(true);
    expect(usesQuality("webp")).toBe(false);
  });

  it("formats byte counts", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3_145_728)).toBe("3.0 MB");
    expect(formatBytes(null)).toBe("-");
  });
});

describe("computeTargetSize (mirrors Rust)", () => {
  it("keeps original dims", () => {
    expect(computeTargetSize(800, 600, { mode: "original" }, false)).toEqual({ w: 800, h: 600 });
  });

  it("scales long edge", () => {
    expect(computeTargetSize(400, 200, { mode: "long-edge", long_edge: 100 }, false)).toEqual({ w: 100, h: 50 });
    expect(computeTargetSize(200, 400, { mode: "long-edge", long_edge: 100 }, false)).toEqual({ w: 50, h: 100 });
  });

  it("fits, stretches and fills exact boxes", () => {
    expect(computeTargetSize(400, 200, { mode: "exact", width: 100, height: 100, fit: "fit" }, false)).toEqual({ w: 100, h: 50 });
    expect(computeTargetSize(400, 200, { mode: "exact", width: 100, height: 100, fit: "stretch" }, false)).toEqual({ w: 100, h: 100 });
    expect(computeTargetSize(400, 200, { mode: "exact", width: 100, height: 100, fit: "fill" }, false)).toEqual({ w: 200, h: 100 });
  });

  it("scales by percent", () => {
    expect(computeTargetSize(200, 100, { mode: "percent", percent: 50 }, false)).toEqual({ w: 100, h: 50 });
  });

  it("never enlarges when asked", () => {
    expect(computeTargetSize(100, 80, { mode: "percent", percent: 400 }, true)).toEqual({ w: 100, h: 80 });
  });
});

describe("groupBy + effTargetOf", () => {
  it("groups rows by effective target and falls back safely", () => {
    const jobs = [
      { target: "jpg" },
      { target: "png" },
      { target: "jpg" },
      { target: "tiff" },
    ];
    const groups = groupBy(jobs, (j) => effTargetOf(j.target, ["png", "jpg", "webp"]));
    expect(groups.get("jpg")).toHaveLength(2);
    expect(groups.get("png")).toHaveLength(2);
    expect(effTargetOf("tiff", ["png", "jpg", "webp"])).toBe("png");
    expect(effTargetOf("tiff", ["png", "jpg", "webp", "tiff"])).toBe("tiff");
  });
});

describe("converter coverage", () => {
  it("accepts PSD input on desktop engines", () => {
    expect(isInputSupported("design.psd")).toBe(true);
  });

  it("keeps PSD out of the web decoder list", () => {
    expect(isWebInputSupported("design.psd")).toBe(false);
    expect(isWebInputSupported("photo.jpg")).toBe(true);
    expect(WEB_FORMATS).toEqual(["png", "jpg", "webp"]);
  });

  it("maps settings to a resize input", () => {
    const r = resizeInputFromSettings({
      resizeMode: "exact",
      longEdge: 1920,
      exactW: "800",
      exactH: "600",
      fit: "fill",
      percent: "100",
      preset: 1920,
    });
    expect(r).toMatchObject({ mode: "exact", width: 800, height: 600, fit: "fill" });
  });

  it("documents every output format with a card", () => {
    expect(FORMAT_CARDS.map((c) => c.id).sort()).toEqual(
      ["bmp", "exr", "ff", "gif", "hdr", "ico", "jpg", "png", "pnm", "qoi", "tga", "tiff", "webp"],
    );
    for (const c of FORMAT_CARDS) {
      expect(c.note.length).toBeGreaterThan(0);
    }
  });
});
