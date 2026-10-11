import { geoAlbersUsa, geoArea, geoPath } from "d3-geo";
import type { BoundaryCollection } from "./facility-map-contracts";
import type { Facility } from "./contracts";
import { facilityCoordinates } from "./facility-map-model";

/** D3 uses spherical clockwise exteriors; RFC 7946 feeds can use the reverse. */
export function sphericalBoundaries(
  collection: BoundaryCollection,
): BoundaryCollection {
  return {
    ...collection,
    features: collection.features.map((feature) => {
      if (geoArea(feature) <= 2 * Math.PI) return feature;
      const geometry = feature.geometry;
      return {
        ...feature,
        geometry:
          geometry.type === "Polygon"
            ? {
                ...geometry,
                coordinates: geometry.coordinates.map((ring) =>
                  [...ring].reverse(),
                ),
              }
            : {
                ...geometry,
                coordinates: geometry.coordinates.map((polygon) =>
                  polygon.map((ring) => [...ring].reverse()),
                ),
              },
      };
    }),
  };
}
export function projectFacilityMap(
  collection: BoundaryCollection,
  facilities: Facility[],
  width: number,
  height: number,
) {
  const boundaries = sphericalBoundaries(collection);
  const projection = geoAlbersUsa().fitExtent(
    [
      [16, 16],
      [width - 16, height - 16],
    ],
    boundaries,
  );
  const path = geoPath(projection);
  return {
    districts: boundaries.features.flatMap((feature) => {
      const outline = path(feature);
      return outline
        ? [{ id: feature.id, name: feature.properties.name, outline }]
        : [];
    }),
    markers: facilities.flatMap((facility) => {
      const coordinate = facilityCoordinates(facility);
      const point = coordinate && projection(coordinate);
      return point &&
        point.every(Number.isFinite) &&
        point[0] >= 0 &&
        point[0] <= width &&
        point[1] >= 0 &&
        point[1] <= height
        ? [{ facility, x: point[0], y: point[1] }]
        : [];
    }),
  };
}
