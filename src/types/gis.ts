export type InspectResult = {
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

export type ParsedPrj = {
  crsType?: "Projected" | "Geographic" | "Unknown";
  projectionName?: string;
  datumName?: string;
  unitName?: string;
};
