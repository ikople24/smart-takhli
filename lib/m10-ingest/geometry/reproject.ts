import proj4 from "proj4";

// EPSG:24047 = Indian 1975 / UTM 47N (Everest 1830) + 3-param towgs84 (Thailand). ห้ามตัด towgs84.
const EPSG_24047 = "+proj=utm +zone=47 +ellps=evrst30 +towgs84=210,814,289,0,0,0,0 +units=m +no_defs";
const EPSG_4326 = "+proj=longlat +datum=WGS84 +no_defs";
const transform = proj4(EPSG_24047, EPSG_4326);

export function reprojectPoint(coord: [number, number]): [number, number] {
  const [lon, lat] = transform.forward(coord);
  return [lon, lat];
}

type Ring = [number, number][];
const reprojectRing = (ring: Ring): Ring => ring.map((c) => reprojectPoint([c[0], c[1]]));

export function reprojectGeometry(
  geom: GeoJSON.Polygon | GeoJSON.MultiPolygon
): GeoJSON.Polygon | GeoJSON.MultiPolygon {
  if (geom.type === "Polygon")
    return { type: "Polygon", coordinates: (geom.coordinates as Ring[]).map(reprojectRing) };
  return { type: "MultiPolygon", coordinates: (geom.coordinates as Ring[][]).map((poly) => poly.map(reprojectRing)) };
}
