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
    <div className="mt-3.5 border border-gray-300 rounded-xl p-3.5 bg-white">
      <div>
        <h2 className="font-bold mb-1.5">
          Sesuaikan Luasan
        </h2>
        <p className="text-[#666] text-sm">
          Sistem melakukan penskalaan dalam <b>EPSG:3857</b> dan melakukan iterasi hingga
          2 angka di belakang koma persis sama dengan luas yang kamu masukkan.
        </p>
      </div>

      <div className="my-2 flex gap-2 items-center flex-wrap">
        <label htmlFor="targetOssArea">
          Target luasan (m²):
        </label>
        <input
          id="targetOssArea"
          name="targetOssArea"
          value={targetOssArea}
          className="py-2 px-2.5 rounded-lg border border-gray-300 flex-1 text-sm"
          onChange={(e) => setTargetOssArea(e.target.value)}
          placeholder={`e.g. ${fmt(result.totalAreaOssSqM, 2)}`}
        />
        <button 
          className="px-3 py-2 rounded-lg border border-blue-300 text-sm font-semibold text-blue-600 hover:bg-blue-100 hover:border-blue-400 transition"
          onClick={onConvertAreaExact} 
          disabled={busy}
        >
          Konversi
        </button>

        <button 
          className="px-3 py-2 text-sm font-semibold cursor-pointer border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition"
          onClick={onReset} 
          disabled={!canReset || busy}
        >
          Reset
        </button>
      </div>

      <div className="text-right text-xs">
        <span className="font-semibold">Luas di OSS sementara:</span> {fmt(result.totalAreaOssSqM, 2)} m²{" "}
        <span style={{ color: "#888" }}>|</span> <span className="font-semibold">Lebar bbox OSS:</span> {fmt(result.ossWidthMeters, 2)} m
      </div>
    </div>
  );
}
