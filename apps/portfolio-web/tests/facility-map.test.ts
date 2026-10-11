import { describe, expect, it } from "vitest";
import { geoArea } from "d3-geo";
import {
  facilityCoordinates,
  facilityDistrict,
  facilityFormBody,
} from "../src/features/client-profile/facility-map-model";
import {
  projectFacilityMap,
  sphericalBoundaries,
} from "../src/features/client-profile/facility-map-projection";
import {
  boundaryCollectionSchema,
  representationSchema,
} from "../src/features/client-profile/facility-map-contracts";
import { boundaryFixture, facility } from "./facility-map-fixtures";

describe("facility coordinate and boundary projection", () => {
  it("retains numeric decimal coordinates but rejects empty, nonfinite and out-of-range values", () => {
    expect(facilityCoordinates(facility)).toEqual([-118.25, 34.05]);
    for (const latitude of [null, "", " ", "NaN", 91, Infinity])
      expect(facilityCoordinates({ ...facility, latitude })).toBeNull();
    expect(facilityCoordinates({ ...facility, longitude: -181 })).toBeNull();
    expect(facilityDistrict({ ...facility, congressionalDistrict: "1" })).toBe(
      "CA-01",
    );
  });
  it("normalizes RFC winding without mutating the response and fits real coordinate pins inside the map", () => {
    const before = JSON.stringify(boundaryFixture);
    const normalized = sphericalBoundaries(boundaryFixture);
    expect(
      normalized.features.every((feature) => geoArea(feature) < 2 * Math.PI),
    ).toBe(true);
    const result = projectFacilityMap(
      boundaryFixture,
      [
        facility,
        { ...facility, id: "outside", latitude: 18.2, longitude: -66.5 },
      ],
      720,
      400,
    );
    expect(result.districts).toHaveLength(2);
    expect(result.markers).toHaveLength(1);
    expect(result.markers[0]?.x).toBeGreaterThan(16);
    expect(result.markers[0]?.y).toBeLessThan(384);
    expect(JSON.stringify(boundaryFixture)).toBe(before);
  });
  it("preserves explicit unresolved representation and rejects future geometry in the current view", () => {
    expect(
      representationSchema.parse([
        {
          facility: { id: "one", name: "Site", city: null, state: null },
          representation: { unresolved: true, reason: "no_state" },
        },
      ])[0]?.representation.unresolved,
    ).toBe(true);
    expect(
      boundaryCollectionSchema.safeParse({
        ...boundaryFixture,
        features: [
          {
            ...boundaryFixture.features[0],
            properties: {
              ...boundaryFixture.features[0]?.properties,
              status: "F",
            },
          },
        ],
      }).success,
    ).toBe(false);
  });
});
describe("facility form semantics", () => {
  it("clears optional fields, preserves zero headcount, normalizes state and requires a state for a district", () => {
    expect(
      facilityFormBody(
        {
          name: "Site",
          state: "ca",
          notes: "",
          employeeCount: "0",
          congressionalDistrict: "",
        },
        facility,
      ),
    ).toEqual({
      name: "Site",
      state: "CA",
      notes: null,
      employeeCount: 0,
      congressionalDistrict: null,
    });
    expect(() =>
      facilityFormBody({ name: "Site", state: "", congressionalDistrict: "1" }),
    ).toThrow("Pick a state");
    expect(() =>
      facilityFormBody({ name: "Site", employeeCount: "1.5" }),
    ).toThrow("whole number");
  });
});
