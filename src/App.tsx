import "./index.css";
import { useMemo, useState } from "react";
import JSZip from "jszip";
import shp from "shpjs";
import proj4 from "proj4";
import * as turf from "@turf/turf";
import shpwrite from "@mapbox/shp-write";

// @ts-expect-error wkt-parser don't have ts module
import wktParser from "wkt-parser";


// Ensure proj4 knows these EPSG defs (safe even if already present)
proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs +type=crs");
proj4.defs(
  "EPSG:3857",
  "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs +type=crs"
);

type InspectResult = {
  fileName: string;
  prjText?: string;
  crsType?: "Projected" | "Geographic" | "Unknown";
  projectionName?: string;
  datumName?: string;
  unitName?: string;
  epsgGuess?: string;

  featureCount: number;
  geometryTypes: string[];
  fieldNames: string[];

  bbox: [number, number, number, number]; // lon/lat bbox
  widthDegrees: number;
  heightDegrees: number;
  widthMeters: number;
  heightMeters: number;

  ossWidthMeters: number;
  ossHeightMeters: number;

  totalAreaSqM: number; // turf area (lon/lat)
  totalAreaOssSqM: number; // planar area in EPSG:3857 (OSS)
  totalPerimeterM: number;

  pointCoordinates: [number, number][];
  geojson: GeoJSON.FeatureCollection;
};

function downloadText(filename: string, text: string, mime = "application/json") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function tryGuessEPSG(prjText?: string): string | undefined {
  if (!prjText) return undefined;
  const t = prjText.toLowerCase();

  if (t.includes("wgs_1984") && t.includes("geogcs")) return "EPSG:4326 (WGS 84)";
  if (t.includes("wgs 84") && t.includes("geogcs")) return "EPSG:4326 (WGS 84)";
  if (
    t.includes("web_mercator") ||
    t.includes("pseudo-mercator") ||
    t.includes("popular visualisation pseudo-mercator")
  )
    return "EPSG:3857 (Web Mercator)";

  const utmMatch = prjText.match(/UTM\s*zone\s*(\d{1,2})([NS])?/i);
  if (utmMatch) {
    const zone = parseInt(utmMatch[1], 10);
    const hemi = (utmMatch[2] || "").toUpperCase();
    if (zone >= 1 && zone <= 60) {
      if (hemi === "S") return `EPSG:327${String(zone).padStart(2, "0")} (WGS 84 / UTM zone ${zone}S)`;
      if (hemi === "N") return `EPSG:326${String(zone).padStart(2, "0")} (WGS 84 / UTM zone ${zone}N)`;
      return `UTM zone ${zone} (hemisphere unknown)`;
    }
  }

  return "Unknown (could not reliably infer EPSG from .prj)";
}

function parsePrj(prjText?: string): {
  crsType?: "Projected" | "Geographic" | "Unknown";
  projectionName?: string;
  datumName?: string;
  unitName?: string;
} {
  if (!prjText) return { crsType: "Unknown" };

  try {
    const parsed: any = wktParser(prjText);
    const raw = prjText.trim().toUpperCase();
    const crsType =
      raw.startsWith("PROJCS[") ? "Projected" : raw.startsWith("GEOGCS[") ? "Geographic" : "Unknown";

    let projectionName: string | undefined;
    let datumName: string | undefined;
    let unitName: string | undefined;

    const walk = (node: any) => {
      if (!node) return;
      if (Array.isArray(node)) {
        const tag = typeof node[0] === "string" ? node[0].toUpperCase() : "";
        if ((tag === "PROJCS" || tag === "GEOGCS") && typeof node[1] === "string") {
          if (!projectionName) projectionName = node[1];
        }
        if (tag === "PROJECTION" && typeof node[1] === "string") projectionName = projectionName || node[1];
        if (tag === "DATUM" && typeof node[1] === "string") datumName = node[1];
        if (tag === "UNIT" && typeof node[1] === "string") unitName = node[1];
        for (const child of node) walk(child);
      } else if (typeof node === "object") {
        for (const k of Object.keys(node)) walk((node as any)[k]);
      }
    };

    walk(parsed);
    return { crsType, projectionName, datumName, unitName };
  } catch {
    const raw = prjText.trim().toUpperCase();
    const crsType =
      raw.startsWith("PROJCS[") ? "Projected" : raw.startsWith("GEOGCS[") ? "Geographic" : "Unknown";
    return { crsType };
  }
}

// Exactly 2 decimals for display
function fmt(n: number, digits = 2) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function roundTo(n: number, decimals: number) {
  const p = 10 ** decimals;
  return Math.round(n * p) / p;
}

// -------- OSS helpers (WGS84 -> EPSG:3857) --------
const to3857 = proj4("EPSG:4326", "EPSG:3857");

function ringAreaSqM(ring: number[][]): number {
  if (!ring || ring.length < 3) return 0;

  const isClosed =
    ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
  const pts = isClosed ? ring : [...ring, ring[0]];

  let sum = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

function polygonAreaSqM(coords: number[][][]): number {
  if (!coords?.length) return 0;
  const outer = ringAreaSqM(coords[0]);
  const holes = coords.slice(1).reduce((acc, r) => acc + ringAreaSqM(r), 0);
  return Math.max(0, outer - holes);
}

function areaOss3857SqM(geom: GeoJSON.Geometry): number {
  if (!geom) return 0;

  if (geom.type === "Polygon") {
    const projected = geom.coordinates.map((ring) =>
      ring.map(([lon, lat]) => {
        const [x, y] = to3857.forward([lon, lat]);
        return [x, y];
      })
    );
    return polygonAreaSqM(projected as any);
  }

  if (geom.type === "MultiPolygon") {
    return geom.coordinates.reduce((acc, poly) => {
      const projected = poly.map((ring) =>
        ring.map(([lon, lat]) => {
          const [x, y] = to3857.forward([lon, lat]);
          return [x, y];
        })
      );
      return acc + polygonAreaSqM(projected as any);
    }, 0);
  }

  return 0;
}

function eachLonLatCoord(geom: GeoJSON.Geometry, fn: (pt: [number, number]) => void) {
  if (geom.type === "Polygon") {
    geom.coordinates.forEach((ring) => ring.forEach((c) => fn([c[0], c[1]])));
  } else if (geom.type === "MultiPolygon") {
    geom.coordinates.forEach((poly) => poly.forEach((ring) => ring.forEach((c) => fn([c[0], c[1]]))));
  }
}

function computeOssBboxAndSize(fc: GeoJSON.FeatureCollection): {
  bbox3857: [number, number, number, number];
  widthM: number;
  heightM: number;
  center: [number, number];
} {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const f of fc.features) {
    const g = f.geometry;
    if (!g) continue;
    eachLonLatCoord(g as any, ([lon, lat]) => {
      const [x, y] = to3857.forward([lon, lat]);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    });
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return { bbox3857: [0, 0, 0, 0], widthM: 0, heightM: 0, center: [0, 0] };
  }

  const widthM = maxX - minX;
  const heightM = maxY - minY;
  const center: [number, number] = [minX + widthM / 2, minY + heightM / 2];

  return { bbox3857: [minX, minY, maxX, maxY], widthM, heightM, center };
}

function totalOssAreaFromFC(fc: GeoJSON.FeatureCollection): number {
  let total = 0;
  for (const f of fc.features) {
    if (!f.geometry) continue;
    total += areaOss3857SqM(f.geometry as any);
  }
  return total;
}

function scaleFCUniformAboutCenter3857(
  fc: GeoJSON.FeatureCollection,
  center3857: [number, number],
  scale: number
): GeoJSON.FeatureCollection {
  const [cx, cy] = center3857;

  const scalePointLonLat = ([lon, lat]: [number, number]): [number, number] => {
    const [x, y] = to3857.forward([lon, lat]);
    const xs = cx + (x - cx) * scale;
    const ys = cy + (y - cy) * scale;
    const [lon2, lat2] = to3857.inverse([xs, ys]);
    return [lon2, lat2];
  };

  return {
    type: "FeatureCollection",
    features: fc.features.map((f) => {
      const g = f.geometry;
      if (!g) return f;

      if (g.type === "Polygon") {
        const coords = g.coordinates.map((ring) => ring.map((c) => scalePointLonLat([c[0], c[1]])));
        return { ...f, geometry: { ...g, coordinates: coords as any } };
      }

      if (g.type === "MultiPolygon") {
        const coords = g.coordinates.map((poly) =>
          poly.map((ring) => ring.map((c) => scalePointLonLat([c[0], c[1]])))
        );
        return { ...f, geometry: { ...g, coordinates: coords as any } };
      }

      return f;
    }),
  };
}

/**
 * ✅ Match exactly to the last decimal (we use 2 decimals as "last decimal" because UI shows 2 decimals).
 * Iteratively scales (in EPSG:3857) until round(area, 2) == round(target, 2).
 */
function scaleGeometryToOssAreaExact(
  fc: GeoJSON.FeatureCollection,
  targetAreaM2: number,
  decimals = 2,
  maxIter = 10
): GeoJSON.FeatureCollection {
  if (!Number.isFinite(targetAreaM2) || targetAreaM2 <= 0) throw new Error("Target OSS area must be > 0 (m²).");

  const targetRounded = roundTo(targetAreaM2, decimals);

  // Fix center once (keeps polygon position stable)
  const { center } = computeOssBboxAndSize(fc);
  let out = fc;

  for (let i = 0; i < maxIter; i++) {
    const cur = totalOssAreaFromFC(out);
    if (!Number.isFinite(cur) || cur <= 0) throw new Error("Current OSS area is 0; cannot scale.");
    const curRounded = roundTo(cur, decimals);

    if (curRounded === targetRounded) return out;

    // scale factor for area: A' = A * s^2  =>  s = sqrt(target/current)
    const s = Math.sqrt(targetAreaM2 / cur);
    out = scaleFCUniformAboutCenter3857(out, center, s);
  }

  // One last check; if still not equal after maxIter, we fail loudly (rare)
  const finalArea = totalOssAreaFromFC(out);
  if (roundTo(finalArea, decimals) !== targetRounded) {
    throw new Error(
      `Could not reach exact target at ${decimals} decimals. Final=${roundTo(finalArea, decimals)} Target=${targetRounded}`
    );
  }
  return out;
}
// -------------------------------------------------------------------

function buildStats(
  fileName: string,
  prjText: string | undefined,
  crs: { crsType?: "Projected" | "Geographic" | "Unknown"; projectionName?: string; datumName?: string; unitName?: string },
  epsgGuess: string | undefined,
  geojson: GeoJSON.FeatureCollection
): InspectResult {
  const featureCount = geojson.features.length;
  const geometryTypes = Array.from(new Set(geojson.features.map((f) => f.geometry?.type).filter(Boolean) as string[]));
  const fieldNames = Array.from(
    new Set(geojson.features.flatMap((f) => Object.keys((f.properties as any) || {})))
  ).sort((a, b) => a.localeCompare(b));

  const bbox = turf.bbox(geojson) as [number, number, number, number];
  const [minX, minY, maxX, maxY] = bbox;

  const widthDegrees = maxX - minX;
  const heightDegrees = maxY - minY;

  const midY = (minY + maxY) / 2;
  const midX = (minX + maxX) / 2;

  const widthKm = turf.distance([minX, midY], [maxX, midY], { units: "kilometers" });
  const heightKm = turf.distance([midX, minY], [midX, maxY], { units: "kilometers" });

  let totalAreaSqM = 0;
  let totalAreaOssSqM = 0;
  let totalPerimeterM = 0;
  const pointCoordinates: [number, number][] = [];

  for (const f of geojson.features) {
    const g = f.geometry;
    if (!g) continue;

    if (g.type === "Polygon" || g.type === "MultiPolygon") {
      eachLonLatCoord(g as any, (pt) => pointCoordinates.push(pt));
    }

    try {
      totalAreaSqM += turf.area(f as any);
      totalAreaOssSqM += areaOss3857SqM(g as any);

      const asLine = turf.polygonToLine(f as any);
      const perimKm = turf.length(asLine as any, { units: "kilometers" });
      totalPerimeterM += perimKm * 1000;
    } catch {
      // ignore
    }
  }

  const oss = computeOssBboxAndSize(geojson);

  return {
    fileName,
    prjText,
    crsType: crs.crsType,
    projectionName: crs.projectionName,
    datumName: crs.datumName,
    unitName: crs.unitName,
    epsgGuess,
    featureCount,
    geometryTypes,
    fieldNames,
    bbox,
    widthDegrees,
    heightDegrees,
    widthMeters: widthKm * 1000,
    heightMeters: heightKm * 1000,
    ossWidthMeters: oss.widthM,
    ossHeightMeters: oss.heightM,
    totalAreaSqM,
    totalAreaOssSqM,
    totalPerimeterM,
    pointCoordinates,
    geojson,
  };
}

const WGS84_PRJ_WKT =
  'GEOGCS["WGS 84",DATUM["WGS_1984",' +
  'SPHEROID["WGS 84",6378137,298.257223563]],' +
  'PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]]';

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function downloadConvertedShpZip(fc: GeoJSON.FeatureCollection, baseName: string) {
  // Force arraybuffer output (most consistent across builds)
  const zipOut = await shpwrite.zip(fc as any, {
    folder: "",                 // keep files at zip root
    filename: baseName,         // base filename
    outputType: "arraybuffer",  // ✅ consistent output
    compression: "DEFLATE",
    prj: WGS84_PRJ_WKT,
    types: {
      polygon: baseName,
      // polyline: baseName,
      point: baseName,
    },
  }) as any;

  // Normalize to Blob for download
  let blob: Blob;

  if (zipOut instanceof Blob) {
    blob = zipOut;
  } else if (zipOut instanceof ArrayBuffer) {
    blob = new Blob([zipOut], { type: "application/zip" });
  } else if (zipOut?.buffer instanceof ArrayBuffer) {
    // Uint8Array or similar
    blob = new Blob([zipOut.buffer], { type: "application/zip" });
  } else {
    console.log(zipOut);
    throw new Error("shp-write zip output is not Blob/ArrayBuffer. Unexpected output type.");
  }

  downloadBlob(`${baseName}.zip`, blob);
}


export default function App() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [result, setResult] = useState<InspectResult | null>(null);
  const [originalGeojson, setOriginalGeojson] = useState<GeoJSON.FeatureCollection | null>(null);

  const [targetOssArea, setTargetOssArea] = useState<string>("");

  const geojsonPreview = useMemo(() => {
    if (!result) return "";
    const clone = { ...result.geojson, features: result.geojson.features.slice(0, 2) };
    return JSON.stringify(clone, null, 2);
  }, [result]);

  async function handleZip(file: File) {
    setBusy(true);
    setError(null);
    setResult(null);
    setOriginalGeojson(null);
    setTargetOssArea("");

    try {
      const arrayBuffer = await file.arrayBuffer();

      const zip = await JSZip.loadAsync(arrayBuffer);
      const prjFile = Object.values(zip.files).find((f) => f.name.toLowerCase().endsWith(".prj"));
      const prjText = prjFile ? await prjFile.async("text") : undefined;

      const crs = parsePrj(prjText);
      const epsgGuess = tryGuessEPSG(prjText);

      const geojson = (await shp(arrayBuffer)) as GeoJSON.FeatureCollection;

      if (!geojson || geojson.type !== "FeatureCollection") throw new Error("Failed to read shapefile: not a FeatureCollection.");
      if (!geojson.features?.length) throw new Error("No features found in shapefile.");

      setOriginalGeojson(JSON.parse(JSON.stringify(geojson)));

      const stats = buildStats(file.name, prjText, crs, epsgGuess, geojson);
      setResult(stats);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  function onConvertAreaExact() {
    if (!result) return;
    const t = Number(targetOssArea);
    if (!Number.isFinite(t) || t <= 0) {
      setError("Target OSS area must be a number > 0 (m²).");
      return;
    }

    try {
      setError(null);

      // ✅ exact match at 2 decimals (same as display)
      const scaled = scaleGeometryToOssAreaExact(result.geojson, t, 2, 10);

      // rebuild stats
      const crs = {
        crsType: result.crsType,
        projectionName: result.projectionName,
        datumName: result.datumName,
        unitName: result.unitName,
      };
      const stats = buildStats(result.fileName, result.prjText, crs, result.epsgGuess, scaled);
      setResult(stats);
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }

  function onReset() {
    if (!originalGeojson || !result) return;
    try {
      setError(null);
      const resetGeojson = JSON.parse(JSON.stringify(originalGeojson)) as GeoJSON.FeatureCollection;

      const crs = {
        crsType: result.crsType,
        projectionName: result.projectionName,
        datumName: result.datumName,
        unitName: result.unitName,
      };
      const stats = buildStats(result.fileName, result.prjText, crs, result.epsgGuess, resetGeojson);
      setResult(stats);
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }

  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui", padding: 20, maxWidth: 1150, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>Shapefile Zip Inspector (Client-side)</h1>
      <p style={{ color: "#444" }}>
        Upload a <b>.zip</b> containing <code>.shp/.shx/.dbf</code> (and ideally <code>.prj</code>). Everything runs in your browser.
      </p>

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
        <input
          type="file"
          accept=".zip,application/zip"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleZip(f);
          }}
        />

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
          disabled={!result}
          onClick={() => {
            if (!result) return;
            console.log("test")
            const baseName = result.fileName.replace(/\.zip$/i, "") + "_converted";
            downloadConvertedShpZip(result.geojson, baseName);
          }}
        >
          Download Converted SHP (ZIP)
        </button>
        </div>
      </div>

      {busy && <p style={{ marginTop: 14 }}>Reading shapefile…</p>}

      {error && (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "#ffecec", border: "1px solid #ffb3b3" }}>
          <b>Error:</b> {error}
        </div>
      )}

      {result && (
        <>
          {/* OSS Area adjust tool */}
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

              <button onClick={onReset} disabled={!originalGeojson || busy}>
                Reset
              </button>
            </div>

            <div style={{ marginLeft: "auto", color: "#333", fontSize: 13 }}>
              <b>Current OSS area:</b> {fmt(result.totalAreaOssSqM, 2)} m²{" "}
              <span style={{ color: "#888" }}>|</span>{" "}
              <b>OSS bbox width:</b> {fmt(result.ossWidthMeters, 2)} m
            </div>
          </div>

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
                <summary>
                  <b>Point Coordinates (WGS84)</b> ({result.pointCoordinates.length})
                </summary>
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

            <div style={{ gridColumn: "1 / -1", border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
              <h2 style={{ marginTop: 0 }}>GeoJSON Preview (first 2 features)</h2>
              <pre style={{ color: "black", whiteSpace: "pre-wrap", background: "#f5f5f5", padding: 10, borderRadius: 10, overflow: "auto" }}>
                {geojsonPreview}
              </pre>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
