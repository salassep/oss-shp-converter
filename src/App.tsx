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
    <div className="font-sans p-5 mx-auto my-0 max-w-287.5">
      <h1 className="m-0 font-bold text-xl">OSS SHP Converter</h1>
      <p className="mt-2">
        Tool ini digunakan untuk menginspeksi dan mengkonversi SHP Polygon sesuai
        dengan luasan yang kamu mau. Sistem akan menyesuaikannya dengan sistem koordinat dan 
        proyeksi yang digunakan oleh OSS dengan membesarkan atau mengecilkan polygon
        secara merata dari tengah sehingga bentuknya tetap sama.
      </p>
      <p className="mt-2">
        <span className="font-semibold">Note</span>: Tool ini bertujuan menyesuaikan luasan SHP 
        polygon agar akurat dan sesuai dengan perhitungan sistem OSS, karena terkadang terjadi 
        selisih beberapa meter saat diunggah. Tidak disarankan jika selisih luasan 
        terlalu besar. Selalu periksa kembali file polygon sebelum diunggah ke OSS. 
        Segala kekeliruan menjadi tanggung jawab kamu sepenuhnya.
      </p>
      <div className="mt-2">
        <h2 className="font-semibold">Bagaimana cara menggunakannya?</h2>
        <p className="text-[#444]">
          Unggah file <b>.zip</b> yang didalamnya terdapat file <code>.shp/.shx/.dbf</code> (disarankan ada <code>.prj</code>).
          Jika ingin mengkonversi silahkan masukkan luasan lalu klik tombol konversi.
        </p>
      </div>
      <div className="mt-4"
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
