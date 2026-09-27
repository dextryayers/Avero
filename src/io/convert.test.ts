import { describe, it, expect } from "vitest";
import {
  baseOf,
  buildOutputPath,
  defaultSuffix,
  extOf,
  formatBytes,
  isInputSupported,
  needsMatte,
  parentOf,
  usesQuality,
} from "./convert";

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
