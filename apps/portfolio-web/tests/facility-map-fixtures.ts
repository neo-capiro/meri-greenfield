import type { BoundaryCollection } from "../src/features/client-profile/facility-map-contracts";
import type { Facility } from "../src/features/client-profile/contracts";
export const facilityClientId = "10000000-0000-4000-8000-000000000001";
export const facility: Facility = {
  id: "facility-test",
  clientId: facilityClientId,
  name: "Synthetic lab",
  addressLine: "1 Test Street",
  city: "Los Angeles",
  state: "CA",
  zip: "90001",
  congressionalDistrict: "01",
  employeeCount: 12,
  notes: "Synthetic fixture",
  latitude: "34.05",
  longitude: "-118.25",
  geocodeStatus: "matched",
  districtSource: "geocoded",
};
export const boundaryFixture: BoundaryCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "CA-01",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-125, 32],
            [-114, 32],
            [-114, 42],
            [-125, 42],
            [-125, 32],
          ],
        ],
      },
      properties: {
        state: "CA",
        districtCode: "01",
        status: "C",
        vintage: "119",
        legislativeDistrictId: null,
        name: "Synthetic west boundary",
        centroid: [-118, 36],
      },
    },
    {
      type: "Feature",
      id: "VA-08",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-84, 36],
            [-75, 36],
            [-75, 40],
            [-84, 40],
            [-84, 36],
          ],
        ],
      },
      properties: {
        state: "VA",
        districtCode: "08",
        status: "C",
        vintage: "119",
        legislativeDistrictId: null,
        name: "Synthetic east boundary",
        centroid: [-79, 38],
      },
    },
  ],
};
