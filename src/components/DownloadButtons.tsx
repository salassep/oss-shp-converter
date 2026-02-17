import { downloadText, downloadConvertedShpZip } from "../lib/downloads";
import type { InspectResult } from "../types/gis";

export function DownloadButtons({ 
  busy, 
  result,
  isAlreadyConverted 
}: { 
  busy: boolean; 
  result: InspectResult | null;
  isAlreadyConverted: boolean
}) {
  return (
    <div className="mt-3.5 border border-gray-300 rounded-xl p-4 bg-gray-50">
      <div className="flex flex-wrap gap-2">
        <button
          className="px-3 py-2 flex-1 rounded-lg border border-blue-300 text-sm font-semibold text-blue-600 hover:bg-blue-100 hover:border-blue-400 transition cursor-pointer"
          disabled={!result}
          onClick={() => {
            if (!result) return;
            downloadText(result.fileName.replace(/\.zip$/i, "") + ".geojson", JSON.stringify(result.geojson));
          }}
        >
          Download GeoJSON
        </button>

        <button
          className="px-3 py-2 flex-1 rounded-lg border border-blue-300 text-sm font-semibold text-blue-600 hover:bg-blue-100 hover:border-blue-400 transition cursor-pointer"
          disabled={!result?.prjText}
          onClick={() => {
            if (!result?.prjText) return;
            downloadText(result.fileName.replace(/\.zip$/i, "") + ".prj.wkt", result.prjText, "text/plain");
          }}
        >
          Download .prj (WKT)
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mt-2">
        <button
          className="flex-1 px-3 py-2 rounded-lg border border-blue-300 text-sm font-semibold text-blue-600 hover:bg-blue-100 hover:border-blue-400 transition cursor-pointer"
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
          className="flex-1 px-3 py-2 rounded-lg border border-blue-300 text-sm font-semibold text-blue-600 hover:bg-blue-100 hover:border-blue-400 transition cursor-pointer disabled:border-gray-400 disabled:text-gray-400 disabled:cursor-default disabled:hover:bg-gray-50"
          disabled={!result || busy || !isAlreadyConverted}
          onClick={() => {
            if (!result) return;
            const baseName = result.fileName.replace(/\.zip$/i, "") + "_converted";
            downloadConvertedShpZip(result.geojson, baseName);
          }}
        >
          Download SHP Terkonversi (ZIP)
        </button>
      </div>

    </div>
  );
}
