class FakeImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  constructor(dataOrW: any, h?: number, opts?: any) {
    if (typeof dataOrW === "number") {
      this.width = dataOrW;
      this.height = h ?? 1;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    } else {
      this.data = dataOrW instanceof Uint8ClampedArray ? dataOrW : new Uint8ClampedArray(dataOrW);
      this.width = h ?? 1;
      this.height = opts?.height ?? Math.max(1, Math.floor(this.data.length / 4 / this.width));
      // dukungan new ImageData(Uint8ClampedArray, w, h)
      if (typeof opts === "number") this.height = opts;
      else if (arguments.length >= 3 && typeof arguments[2] === "number") this.height = arguments[2] as number;
    }
  }
}

if (!(globalThis as any).ImageData) {
  (globalThis as any).ImageData = FakeImageData as any;
}
