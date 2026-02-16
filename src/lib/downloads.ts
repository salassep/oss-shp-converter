import shpwrite from "@mapbox/shp-write";

export function downloadText(filename: string, text: string, mime = "application/json") {
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

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const WGS84_PRJ_WKT =
  'GEOGCS["WGS 84",DATUM["WGS_1984",' +
  'SPHEROID["WGS 84",6378137,298.257223563]],' +
  'PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]]';

export async function downloadConvertedShpZip(fc: GeoJSON.FeatureCollection, baseName: string) {
  const zipOut = (await shpwrite.zip(fc as any, {
    folder: "",
    filename: baseName,
    outputType: "arraybuffer",
    compression: "DEFLATE",
    prj: WGS84_PRJ_WKT,
    types: {
      polygon: baseName,
      point: baseName,
    },
  })) as any;

  let blob: Blob;

  if (zipOut instanceof Blob) {
    blob = zipOut;
  } else if (zipOut instanceof ArrayBuffer) {
    blob = new Blob([zipOut], { type: "application/zip" });
  } else if (zipOut?.buffer instanceof ArrayBuffer) {
    blob = new Blob([zipOut.buffer], { type: "application/zip" });
  } else {
    console.log(zipOut);
    throw new Error("shp-write zip output is not Blob/ArrayBuffer. Unexpected output type.");
  }

  downloadBlob(`${baseName}.zip`, blob);
}
