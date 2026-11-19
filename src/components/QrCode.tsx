import { useMemo } from "react";
import { encode } from "uqr";

/** QR rendered as a single SVG path from the module matrix — no innerHTML. */
export function QrCode({ text, label, className = "" }: { text: string; label: string; className?: string }) {
  const { d, size } = useMemo(() => {
    const qr = encode(text, { ecc: "M", border: 2 });
    let path = "";
    qr.data.forEach((row, y) => row.forEach((on, x) => { if (on) path += `M${x} ${y}h1v1h-1z`; }));
    return { d: path, size: qr.size };
  }, [text]);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className={className} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#fff" />
      <path d={d} fill="#13201a" />
    </svg>
  );
}
