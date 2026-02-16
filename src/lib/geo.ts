import { to3857 } from "./crs";

export function roundTo(n: number, decimals: number) {
  const p = 10 ** decimals;
  return Math.round(n * p) / p;
}

export function eachLonLatCoord(geom: GeoJSON.Geometry, fn: (pt: [number, number]) => void) {
  if (geom.type === "Polygon") {
    geom.coordinates.forEach((ring) => ring.forEach((c) => fn([c[0], c[1]])));
  } else if (geom.type === "MultiPolygon") {
    geom.coordinates.forEach((poly) => poly.forEach((ring) => ring.forEach((c) => fn([c[0], c[1]]))));
  }
}

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

export function areaOss3857SqM(geom: GeoJSON.Geometry): number {
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

export function totalOssAreaFromFC(fc: GeoJSON.FeatureCollection): number {
  let total = 0;
  for (const f of fc.features) {
    if (!f.geometry) continue;
    total += areaOss3857SqM(f.geometry as any);
  }
  return total;
}

export function computeOssBboxAndSize(fc: GeoJSON.FeatureCollection): {
  bbox3857: [number, number, number, number];
  widthM: number;
  heightM: number;
  center: [number, number];
} {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

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

export function scaleFCUniformAboutCenter3857(
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

export function scaleGeometryToOssAreaExact(
  fc: GeoJSON.FeatureCollection,
  targetAreaM2: number,
  decimals = 2,
  maxIter = 10
): GeoJSON.FeatureCollection {
  if (!Number.isFinite(targetAreaM2) || targetAreaM2 <= 0) throw new Error("Target OSS area must be > 0 (m²).");

  const targetRounded = roundTo(targetAreaM2, decimals);

  const { center } = computeOssBboxAndSize(fc);
  let out = fc;

  for (let i = 0; i < maxIter; i++) {
    const cur = totalOssAreaFromFC(out);
    if (!Number.isFinite(cur) || cur <= 0) throw new Error("Current OSS area is 0; cannot scale.");
    const curRounded = roundTo(cur, decimals);

    if (curRounded === targetRounded) return out;

    const s = Math.sqrt(targetAreaM2 / cur);
    out = scaleFCUniformAboutCenter3857(out, center, s);
  }

  const finalArea = totalOssAreaFromFC(out);
  if (roundTo(finalArea, decimals) !== targetRounded) {
    throw new Error(
      `Could not reach exact target at ${decimals} decimals. Final=${roundTo(finalArea, decimals)} Target=${targetRounded}`
    );
  }
  return out;
}
