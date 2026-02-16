import * as turf from "@turf/turf";
import type { InspectResult, ParsedPrj } from "../types/gis";
import { areaOss3857SqM, computeOssBboxAndSize, eachLonLatCoord } from "./geo";

export function buildStats(
  fileName: string,
  prjText: string | undefined,
  crs: ParsedPrj,
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
