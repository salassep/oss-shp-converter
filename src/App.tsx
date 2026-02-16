import "./index.css";
import { useMemo, useState } from "react";

import type { InspectResult } from "./types/gis";
import { ensureProjDefs, parsePrj, tryGuessEPSG } from "./lib/crs";
import { extractPrjTextFromZip, zipShpToGeoJson } from "./lib/shp";
import { buildStats } from "./lib/stats";
import { scaleGeometryToOssAreaExact } from "./lib/geo";

import { TopBar } from "./components/TopBar";
import { AreaTool } from "./components/AreaTool";
import { StatsPanels } from "./components/StatsPanels";
import { GeoJsonPreview } from "./components/GeoJsonPreview";

ensureProjDefs();

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

      const prjText = await extractPrjTextFromZip(arrayBuffer);
      const crs = parsePrj(prjText);
      const epsgGuess = tryGuessEPSG(prjText);

      const geojson = await zipShpToGeoJson(arrayBuffer);

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
      const scaled = scaleGeometryToOssAreaExact(result.geojson, t, 2, 10);

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

        <TopBar busy={busy} result={result} />
      </div>

      {busy && <p style={{ marginTop: 14 }}>Reading shapefile…</p>}

      {error && (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "#ffecec", border: "1px solid #ffb3b3" }}>
          <b>Error:</b> {error}
        </div>
      )}

      {result && (
        <>
          <AreaTool
            busy={busy}
            result={result}
            targetOssArea={targetOssArea}
            setTargetOssArea={setTargetOssArea}
            onConvertAreaExact={onConvertAreaExact}
            onReset={onReset}
            canReset={!!originalGeojson}
          />

          <StatsPanels result={result} />
          <GeoJsonPreview preview={geojsonPreview} />
        </>
      )}
    </div>
  );
}
