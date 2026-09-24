import { useEffect, useRef } from "react";
import { useProStore } from "../stores/useProStore";
import { computeHistogram } from "../engine/color";
import { getCompositeCanvas } from "./CanvasArea";

export default function Histogram() {
  const ref = useRef<HTMLCanvasElement>(null);
  const tick = useProStore((s) => s.histogramTick);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = el.getContext("2d")!;
    const W = (el.width = 268);
    const H = (el.height = 84);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#161618";
    ctx.fillRect(0, 0, W, H);
    const comp = getCompositeCanvas();
    if (!comp) {
      ctx.fillStyle = "#a7a7b0";
      ctx.font = "10px Inter";
      ctx.fillText("Buka gambar untuk histogram", 12, 44);
      return;
    }
    try {
      // downscale ke 256px untuk histogram cepat
      const tmp = document.createElement("canvas");
      tmp.width = 256;
      tmp.height = Math.max(1, Math.round((256 * comp.height) / Math.max(1, comp.width)));
      tmp.getContext("2d")!.drawImage(comp, 0, 0, tmp.width, tmp.height);
      const id = tmp
        .getContext("2d", { willReadFrequently: true })!
        .getImageData(0, 0, tmp.width, tmp.height);
      const hist = computeHistogram(id);
      const max = Math.max(...hist.lum, ...hist.r, ...hist.g, ...hist.b, 1);
      const draw = (arr: number[], color: string) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < 256; i++) {
          const x = (i / 255) * W;
          const y = H - (arr[i] / max) * (H - 6) - 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };
      draw(hist.lum, "rgba(255,255,255,0.9)");
      draw(hist.r, "rgba(255,90,90,0.85)");
      draw(hist.g, "rgba(90,220,120,0.85)");
      draw(hist.b, "rgba(90,150,255,0.85)");
    } catch {
      ctx.fillStyle = "#a7a7b0";
      ctx.fillText("Histogram tidak tersedia", 12, 44);
    }
  }, [tick]);

  return (
    <div className="rounded border border-[#2c2c31] bg-[#161618] p-1.5">
      <canvas ref={ref} className="h-[84px] w-full" />
      <div className="mt-1 flex justify-between font-mono text-[9px] text-[#a7a7b0]">
        <span className="text-white">Lum</span>
        <span className="text-red-300">R</span>
        <span className="text-[#a7a7b0]">G</span>
        <span className="text-blue-300">B</span>
      </div>
    </div>
  );
}
