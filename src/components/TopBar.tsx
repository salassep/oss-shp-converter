import { downloadText, downloadConvertedShpZip } from "../lib/downloads";
import type { InspectResult } from "../types/gis";

export function TopBar({ busy, result }: { busy: boolean; result: InspectResult | null }) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 16,
        background: "#fafafa",
        display: "flex",
        gap: 12,
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          disabled={!result}
          onClick={() => {
            if (!result) return;
            downloadText(result.fileName.replace(/\.zip$/i, "") + ".geojson", JSON.stringify(result.geojson));
          }}
        >
          Download GeoJSON
        </button>

        <button
          disabled={!result?.prjText}
          onClick={() => {
            if (!result?.prjText) return;
            downloadText(result.fileName.replace(/\.zip$/i, "") + ".prj.wkt", result.prjText, "text/plain");
          }}
        >
          Download .prj (WKT)
        </button>

        <button
          disabled={!result}
          onClick={() => {
            if (!result) return;
            const lines = result.pointCoordinates.map(([lon, lat]) => `${lon},${lat}`).join("\n");
            downloadText(result.fileName.replace(/\.zip$/i, "") + ".points.csv", "lon,lat\n" + lines, "text/csv");
          }}
        >
          Download Points CSV
        </button>

        <button
          disabled={!result || busy}
          onClick={() => {
            if (!result) return;
            const baseName = result.fileName.replace(/\.zip$/i, "") + "_converted";
            downloadConvertedShpZip(result.geojson, baseName);
          }}
        >
          Download Converted SHP (ZIP)
        </button>
      </div>
    </div>
  );
}
