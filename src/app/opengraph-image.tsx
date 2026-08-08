import { ImageResponse } from "next/og";

export const alt = "Kyozai Shelf - 大学教材カタログ";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#0b1d4a", color: "white", alignItems: "center", padding: "90px", position: "relative" }}>
      <div style={{ display: "flex", position: "absolute", width: 420, height: 420, borderRadius: 999, background: "#0d9488", opacity: 0.25, right: -80, top: -100 }} />
      <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", alignItems: "center", gap: 24 }}><div style={{ display: "flex", width: 80, height: 80, borderRadius: 22, background: "#0d9488", alignItems: "center", justifyContent: "center", fontSize: 42, fontWeight: 900 }}>K</div><div style={{ fontSize: 34, fontWeight: 800 }}>Kyozai Shelf</div></div><div style={{ display: "flex", flexDirection: "column", marginTop: 60, fontSize: 64, fontWeight: 900, lineHeight: 1.2 }}><span>大学の学びを、</span><span>もっと探しやすく。</span></div><div style={{ marginTop: 28, fontSize: 25, color: "#bfdbfe" }}>大学・科目・シリーズから探せる教材カタログ</div></div>
    </div>,
    size,
  );
}
