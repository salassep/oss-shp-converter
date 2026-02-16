import JSZip from "jszip";
import shp from "shpjs";

export async function extractPrjTextFromZip(zipArrayBuffer: ArrayBuffer) {
  const zip = await JSZip.loadAsync(zipArrayBuffer);
  const prjFile = Object.values(zip.files).find((f) => f.name.toLowerCase().endsWith(".prj"));
  return prjFile ? await prjFile.async("text") : undefined;
}

export async function zipShpToGeoJson(zipArrayBuffer: ArrayBuffer) {
  const geojson = (await shp(zipArrayBuffer)) as GeoJSON.FeatureCollection;
  if (!geojson || geojson.type !== "FeatureCollection") throw new Error("Failed to read shapefile: not a FeatureCollection.");
  if (!geojson.features?.length) throw new Error("No features found in shapefile.");
  return geojson;
}
