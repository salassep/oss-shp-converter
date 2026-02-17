import "./index.css";
import { useMemo, useRef, useState } from "react";

import type { InspectResult } from "./types/gis";
import { ensureProjDefs, parsePrj, tryGuessEPSG } from "./lib/crs";
import { extractPrjTextFromZip, zipShpToGeoJson } from "./lib/shp";
import { buildStats } from "./lib/stats";
import { scaleGeometryToOssAreaExact } from "./lib/geo";

// import { TopBar } from "./components/TopBar";
import { AreaTool } from "./components/AreaTool";
import { StatsPanels } from "./components/StatsPanels";
import { GeoJsonPreview } from "./components/GeoJsonPreview";
import { Warning } from "./components/Warning";
import { HowToUse } from "./components/HowToUse";
import { Footer } from "./components/Footer";
import { DownloadButtons } from "./components/DownloadButtons";

ensureProjDefs();

export default function App() {
  const [busy, setBusy] = useState(false);
  const [isConverted, setIsConverted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [result, setResult] = useState<InspectResult | null>(null);
  const [originalGeojson, setOriginalGeojson] = useState<GeoJSON.FeatureCollection | null>(null);

  const [targetOssArea, setTargetOssArea] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setIsConverted(true);
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
      setTargetOssArea("");
      setResult(stats);
      setIsConverted(false);
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }

  function onRemoveUploadedFile() {
    setBusy(false);
    setIsConverted(false);
    setError(null);
    setResult(null);
    setOriginalGeojson(null);
    setTargetOssArea("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <div className="font-sans px-5 pt-5 mx-auto my-0 max-w-287.5 min-h-dvh flex flex-col justify-between text-[#212427)]">
      <div>
        <h1 className="m-0 font-bold text-xl">OSS SHP Converter</h1>
        <p className="mt-2">
          Tool ini digunakan untuk menginspeksi dan mengkonversi SHP Polygon sesuai
          dengan luasan yang kamu mau. Sistem akan menyesuaikannya dengan sistem koordinat dan 
          proyeksi yang digunakan oleh OSS dengan membesarkan atau mengecilkan polygon
          secara merata dari tengah sehingga bentuknya tetap sama.
        </p>
        <div className="mt-4 border border-gray-300 rounded-xl p-4 bg-gray-50 flex gap-2 items-center justify-between flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,application/zip"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleZip(f);
            }}
          />


          {(result || error) && (
            <button 
              className="px-3 py-2 text-sm font-semibold cursor-pointer border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition" 
              onClick={onRemoveUploadedFile}
            >
              Hapus
            </button>
          )}
          
          {/* <TopBar busy={busy} result={result} /> */}
        </div>

        {busy && <p className="mt-3.5">Membaca shapefile…</p>}

        {error && (
          <div className="mt-3.5 p-3 rounded-lg bg-red-50 border border-red-200">
            <b>Error:</b> {error}
          </div>
        )}

        {result && (
          <>
            <AreaTool
              busy={busy}
              result={result}
              targetOssArea={targetOssArea}
              isAlreadyConverted={isConverted}
              setTargetOssArea={setTargetOssArea}
              onConvertAreaExact={onConvertAreaExact}
              onReset={onReset}
              canReset={!!originalGeojson}
            />

            <StatsPanels result={result} />
            <GeoJsonPreview preview={geojsonPreview} />
            <DownloadButtons isAlreadyConverted={isConverted} busy={busy} result={result} />
          </>
        )}

        <Warning />
        <HowToUse />
      </div>
      <Footer />
    </div>
  );
}
