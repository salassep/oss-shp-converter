import type { InspectResult } from "../types/gis";
import { fmt } from "../lib/utils";

export function StatsPanels({ result }: { result: InspectResult }) {
  return (
    <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
        <h2 style={{ marginTop: 0 }}>CRS / Projection</h2>
        <div><b>File:</b> {result.fileName}</div>
        <div><b>CRS type:</b> {result.crsType ?? "Unknown"}</div>
        <div><b>Projection/CRS name:</b> {result.projectionName ?? "Unknown"}</div>
        <div><b>Datum:</b> {result.datumName ?? "Unknown"}</div>
        <div><b>Unit:</b> {result.unitName ?? "Unknown"}</div>
        <div><b>EPSG (guess):</b> {result.epsgGuess ?? "Unknown"}</div>

        <details style={{ marginTop: 10 }}>
          <summary><b>.prj (WKT)</b> {result.prjText ? "" : "(not found in zip)"}</summary>
          <pre style={{ whiteSpace: "pre-wrap", background: "#f5f5f5", padding: 10, borderRadius: 10, overflow: "auto" }}>
            {result.prjText ?? "No .prj found in the zip. Add it for reliable projection info."}
          </pre>
        </details>
      </div>

      <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
        <h2 style={{ marginTop: 0 }}>Geometry & Stats</h2>
        <div><b>Features:</b> {result.featureCount}</div>
        <div><b>Geometry types:</b> {result.geometryTypes.join(", ") || "—"}</div>

        <div style={{ marginTop: 8 }}><b>BBox (lon/lat):</b> [{result.bbox.map((x) => x.toFixed(6)).join(", ")}]</div>
        <div><b>Width:</b> {result.widthDegrees.toFixed(6)}° (~{fmt(result.widthMeters, 2)} m)</div>
        <div><b>Height:</b> {result.heightDegrees.toFixed(6)}° (~{fmt(result.heightMeters, 2)} m)</div>

        <div style={{ marginTop: 10 }}><b>Total area:</b> {fmt(result.totalAreaSqM, 2)} m²</div>
        <div><b>Total area (OSS / EPSG:3857):</b> {fmt(result.totalAreaOssSqM, 2)} m²</div>
        <div><b>Total perimeter:</b> {fmt(result.totalPerimeterM, 2)} m</div>

        <details style={{ marginTop: 12 }}>
          <summary><b>Point Coordinates (WGS84)</b> ({result.pointCoordinates.length})</summary>
          <div
            style={{
              color: "black",
              maxHeight: 300,
              overflow: "auto",
              marginTop: 8,
              background: "#f5f5f5",
              padding: 10,
              borderRadius: 10,
              fontFamily: "monospace",
              fontSize: 13,
            }}
          >
            {result.pointCoordinates.map(([lon, lat], i) => (
              <div key={i}>
                {i + 1}. {lon.toFixed(6)}, {lat.toFixed(6)}
              </div>
            ))}
          </div>
        </details>

        <details style={{ marginTop: 10 }}>
          <summary><b>Attribute fields</b> ({result.fieldNames.length})</summary>
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {result.fieldNames.map((k) => (
              <span key={k} style={{ padding: "4px 8px", border: "1px solid #ddd", borderRadius: 999, background: "#fafafa" }}>
                {k}
              </span>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
