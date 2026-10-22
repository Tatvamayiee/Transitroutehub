import { useEffect, useRef } from "react";

interface RadarPoint {
  angle: number;
  value: number;
  label: string;
  sub?: string;
}

interface Pillar {
  name: string;
  score: number; // 0..5
  weight: number;
  color: string;
  items: { label: string; value: number; note: string }[];
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function ReadinessRadar({ pillars, className }: { pillars: Pillar[]; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = window.devicePixelRatio ?? 1;
    const rect = container.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height, 520);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const outerR = size * 0.42;
    const levels = 5;

    // background
    ctx.clearRect(0, 0, size, size);

    // concentric grid
    for (let l = 1; l <= levels; l++) {
      const r = (outerR / levels) * l;
      ctx.beginPath();
      for (let i = 0; i <= pillars.length; i++) {
        const angle = (i * (360 / pillars.length)) % 360;
        const pt = polarToCartesian(cx, cy, r, angle);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.closePath();
      ctx.fillStyle = l % 2 === 0 ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.06)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // axis lines
    for (let i = 0; i < pillars.length; i++) {
      const angle = i * (360 / pillars.length);
      const pt = polarToCartesian(cx, cy, outerR, angle);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(pt.x, pt.y);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // colored area per pillar (filled polygon of current scores)
    for (let p = 0; p < pillars.length; p++) {
      const pillar = pillars[p];
      if (!pillar) continue;
      const r = (outerR / levels) * pillar.score;
      ctx.beginPath();
      for (let i = 0; i <= pillars.length; i++) {
        const idx = (p + i) % pillars.length;
        const angle = idx * (360 / pillars.length);
        const pt = polarToCartesian(cx, cy, r, angle);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.closePath();
      ctx.fillStyle = pillar.color + "33";
      ctx.fill();
      ctx.strokeStyle = pillar.color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // points + labels
    for (let i = 0; i < pillars.length; i++) {
      const pillar = pillars[i];
      if (!pillar) continue;
      const r = (outerR / levels) * pillar.score;
      const angle = i * (360 / pillars.length);
      const pt = polarToCartesian(cx, cy, r, angle);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = pillar.color;
      ctx.fill();
      ctx.strokeStyle = "#0b1220";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // label outside
      const labelPt = polarToCartesian(cx, cy, outerR * 1.18, angle);
      ctx.save();
      ctx.translate(labelPt.x, labelPt.y);
      ctx.rotate((angle + 90) * (Math.PI / 180));
      ctx.fillStyle = "#e6edf3";
      ctx.font = "600 12px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pillar.name, 0, 0);
      ctx.restore();
    }
  }, [pillars]);

  return (
    <div ref={containerRef} className={`relative mx-auto aspect-square ${className ?? ""}`}>
      <canvas ref={canvasRef} />
    </div>
  );
}
