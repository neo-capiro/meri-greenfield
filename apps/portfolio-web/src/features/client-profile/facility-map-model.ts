import type { Facility } from "./contracts";

export function facilityCoordinates(
  facility: Facility,
): [number, number] | null {
  if (facility.latitude == null || facility.longitude == null) return null;
  if (typeof facility.latitude === "string" && !facility.latitude.trim())
    return null;
  if (typeof facility.longitude === "string" && !facility.longitude.trim())
    return null;
  const latitude = Number(facility.latitude),
    longitude = Number(facility.longitude);
  return Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
    ? [longitude, latitude]
    : null;
}
export function facilityDistrict(facility: Facility): string | null {
  return facility.state && facility.congressionalDistrict
    ? `${facility.state}-${facility.congressionalDistrict.padStart(2, "0")}`
    : null;
}
export function facilityAddress(facility: Facility): string {
  return (
    [facility.addressLine, facility.city, facility.state, facility.zip]
      .filter(Boolean)
      .join(", ") || "Address not specified"
  );
}
export function facilityFormBody(
  raw: Record<string, FormDataEntryValue>,
  facility?: Facility,
): Record<string, string | number | null> {
  const body: Record<string, string | number | null> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== "string") continue;
    const trimmed = key === "state" ? value.trim().toUpperCase() : value.trim();
    if (
      key === "employeeCount" &&
      trimmed &&
      (!Number.isSafeInteger(Number(trimmed)) || Number(trimmed) < 0)
    )
      throw new Error("Employees must be a whole number of zero or more.");
    const result =
      key === "employeeCount" && trimmed ? Number(trimmed) : trimmed || null;
    if (result !== null || facility) body[key] = result;
  }
  if (!String(raw.name ?? "").trim())
    throw new Error("Facility name is required.");
  if (
    String(raw.congressionalDistrict ?? "").trim() &&
    !String(raw.state ?? "").trim()
  )
    throw new Error("Pick a state before setting a district.");
  return body;
}
