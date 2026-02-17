import type { InspectResult } from "../types/gis";
import { fmt } from "../lib/utils";

export function StatsPanels({ result }: { result: InspectResult }) {
  return (
    <div className="mt-4.5 flex flex-row flex-wrap gap-3.5">
      <div className="flex-1 min-w-3xs border border-[#ddd] rounded-xl p-3.5">
        <h2 className="font-bold mb-1.5">
          CRS / Proyeksi
        </h2>
        <div><span className="font-semibold">File:</span> {result.fileName}</div>
        <div><span className="font-semibold">Jenis CRS:</span> {result.crsType ?? "Unknown"}</div>
        <div><span className="font-semibold">Proyeksi/nama CRS:</span> {result.projectionName ?? "Unknown"}</div>
        <div><span className="font-semibold">Datum:</span> {result.datumName ?? "Unknown"}</div>
        <div><span className="font-semibold">Unit:</span> {result.unitName ?? "Unknown"}</div>
        <div><span className="font-semibold">EPSG:</span> {result.epsgGuess ?? "Unknown"}</div>

        <details className="mt-2.5">
          <summary><b>.prj (WKT)</b> {result.prjText ? "" : "(tidak ditemukan di zip)"}</summary>
          <pre className="whitespace-pre-wrap bg-gray-100 p-2.5 rounded-lg overflow-auto">
            {result.prjText ?? "Tidak ada file .prj di zip. Tambahkan untuk info proyeksi yang akurat."}
          </pre>
        </details>
      </div>

      <div className="flex-1 min-w-3xs border border-[#ddd] rounded-xl p-3.5">
        <h2 className="font-bold mb-1.5">
          Geometri & Stats
        </h2>
        <div><span className="font-semibold">Features:</span> {result.featureCount}</div>
        <div><span className="font-semibold">Jenis Geometri:</span> {result.geometryTypes.join(", ") || "—"}</div>

        <div className="mt-2"><span className="font-semibold">BBox (lon/lat):</span> [{result.bbox.map((x) => x.toFixed(6)).join(", ")}]</div>
        <div><span className="font-semibold">Lebar:</span> {result.widthDegrees.toFixed(6)}° (~{fmt(result.widthMeters, 2)} m)</div>
        <div><span className="font-semibold">Tinggi:</span> {result.heightDegrees.toFixed(6)}° (~{fmt(result.heightMeters, 2)} m)</div>

        <div className="mt-2"><span className="font-semibold">Luas:</span> {fmt(result.totalAreaSqM, 2)} m²</div>
        <div><span className="font-semibold">Luas (OSS / EPSG:3857):</span> {fmt(result.totalAreaOssSqM, 2)} m²</div>
        <div><span className="font-semibold">Total perimeter:</span> {fmt(result.totalPerimeterM, 2)} m</div>

        <details className="mt-2">
          <summary><b>Koordinat (WGS84)</b> ({result.pointCoordinates.length})</summary>
          <div className="max-h-75 overflow-auto mt-2 bg-gray-100 p-2.5 rounded-lg font-mono text-[13px]">
            {result.pointCoordinates.map(([lon, lat], i) => (
              <div key={i}>
                {i + 1}. {lon.toFixed(6)}, {lat.toFixed(6)}
              </div>
            ))}
          </div>
        </details>

        <details className="mt-2">
          <summary><b>Attribut</b> ({result.fieldNames.length})</summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {result.fieldNames.map((k) => (
              <span 
                key={k} 
                className="py-1 px-2 border border-gray-300 rounded-full bg-gray-50"
              >
                {k}
              </span>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
