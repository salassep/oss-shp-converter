import type { InspectResult } from "../types/gis";
import { fmt } from "../lib/utils";

export function AreaTool({
  busy,
  result,
  targetOssArea,
  setTargetOssArea,
  onConvertAreaExact,
  onReset,
  canReset,
}: {
  busy: boolean;
  result: InspectResult;
  targetOssArea: string;
  setTargetOssArea: (v: string) => void;
  onConvertAreaExact: () => void;
  onReset: () => void;
  canReset: boolean;
}) {
  return (
    <div
      style={{
        marginTop: 14,
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 14,
        background: "#ffffff",
        display: "flex",
        gap: 10,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <div style={{ minWidth: 320 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Adjust OSS Area (exact to 2 decimals, preserve shape)</div>
        <div style={{ color: "#666", fontSize: 13 }}>
          We scale in <b>EPSG:3857</b> and iterate until <code>round(area, 2)</code> exactly matches your input.
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          Target OSS area (m²):
          <input
            value={targetOssArea}
            onChange={(e) => setTargetOssArea(e.target.value)}
            placeholder={`e.g. ${fmt(result.totalAreaOssSqM, 2)}`}
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd", width: 240 }}
          />
        </label>

        <button onClick={onConvertAreaExact} disabled={busy}>
          Convert
        </button>

        <button onClick={onReset} disabled={!canReset || busy}>
          Reset
        </button>
      </div>

      <div style={{ marginLeft: "auto", color: "#333", fontSize: 13 }}>
        <b>Current OSS area:</b> {fmt(result.totalAreaOssSqM, 2)} m²{" "}
        <span style={{ color: "#888" }}>|</span> <b>OSS bbox width:</b> {fmt(result.ossWidthMeters, 2)} m
      </div>
    </div>
  );
}
