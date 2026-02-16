import proj4 from "proj4";
// @ts-expect-error wkt-parser don't have ts module
import wktParser from "wkt-parser";
import type { ParsedPrj } from "../types/gis";

export function ensureProjDefs() {
  proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs +type=crs");
  proj4.defs(
    "EPSG:3857",
    "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs +type=crs"
  );
}

export const to3857 = proj4("EPSG:4326", "EPSG:3857");

export function tryGuessEPSG(prjText?: string): string | undefined {
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

export function parsePrj(prjText?: string): ParsedPrj {
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
