"use client";
/* eslint-disable @next/next/no-img-element */
import { useMemo } from "react";
import { QueryState } from "@/shared/ui/QueryState";
import type { Facility } from "./contracts";
import { useFacilityBoundaries } from "./facility-map-queries";
import { projectFacilityMap } from "./facility-map-projection";
import { useFacilityMapView } from "./facility-map-view";
import { FacilityMapControls } from "./FacilityMapControls";
import styles from "./facility-map.module.css";

export function FacilityMap({
  facilities,
  onSelect,
  selectedDistrict,
  onDistrictSelect,
  compact = false,
}: {
  facilities: Facility[];
  onSelect: (facility: Facility) => void;
  selectedDistrict?: string;
  onDistrictSelect?: (id: string) => void;
  compact?: boolean;
}) {
  const { manifest, geometry } = useFacilityBoundaries(true);
  const { surface, size, view, interaction, zoom, pan, reset } =
    useFacilityMapView(Boolean(geometry.data));
  const projected = useMemo(
    () =>
      geometry.data
        ? projectFacilityMap(geometry.data, facilities, size.width, size.height)
        : null,
    [geometry.data, facilities, size],
  );
  const error = manifest.error ?? geometry.error;
  return (
    <section className="stack" aria-label="Geographic facility map">
      <QueryState
        pending={
          manifest.isPending || (Boolean(manifest.data) && geometry.isPending)
        }
        error={error}
        retry={() =>
          void (manifest.error ? manifest.refetch() : geometry.refetch())
        }
      />
      {projected && (
        <>
          <div
            ref={surface}
            className={`${styles.map} ${compact ? styles.compactMap : ""}`}
          >
            <svg
              viewBox={`0 0 ${size.width} ${size.height}`}
              role="group"
              tabIndex={0}
              aria-label="Current congressional districts and facility pins"
              {...interaction}
            >
              <rect
                width={size.width}
                height={size.height}
                fill="transparent"
                pointerEvents="none"
              />
              <g
                transform={`translate(${view.x} ${view.y}) translate(${size.width / 2} ${size.height / 2}) scale(${view.scale}) translate(${-size.width / 2} ${-size.height / 2})`}
              >
                {projected.districts.map((district) => (
                  <path
                    key={district.id}
                    d={district.outline}
                    className={styles.district}
                    data-selected={selectedDistrict === district.id}
                    role="button"
                    tabIndex={onDistrictSelect ? 0 : -1}
                    aria-label={`District ${district.id}`}
                    onClick={() => onDistrictSelect?.(district.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onDistrictSelect?.(district.id);
                      }
                    }}
                  >
                    <title>{district.name ?? district.id}</title>
                  </path>
                ))}
              </g>
            </svg>
            {projected.markers.map(({ facility, x, y }) => (
              <button
                key={facility.id}
                className={styles.marker}
                aria-label={`Open facility ${facility.name}`}
                style={{
                  left: `${(100 * (view.x + size.width / 2 + (x - size.width / 2) * view.scale)) / size.width}%`,
                  top: `${(100 * (view.y + size.height / 2 + (y - size.height / 2) * view.scale)) / size.height}%`,
                }}
                onClick={() => onSelect(facility)}
              >
                <img src="/design/411-47066-marker.svg" alt="" />
              </button>
            ))}
            <FacilityMapControls
              scale={view.scale}
              zoom={zoom}
              pan={pan}
              reset={reset}
            />
          </div>
          {facilities.length > projected.markers.length && (
            <p className={styles.source}>
              {facilities.length - projected.markers.length} locations have no
              usable coordinate or fall outside this U.S. projection. Open them
              from the location list.
            </p>
          )}
          <p className={styles.source}>
            Current boundaries · {manifest.data?.vintage} ·{" "}
            {manifest.data?.districtCount} districts. Alaska and Hawaii use
            separate insets. Drag empty map space or focus the map and use arrow
            keys to pan, plus/minus to zoom.
          </p>
          {manifest.data?.warnings.map((warning) => (
            <p className={styles.source} key={warning}>
              {warning}
            </p>
          ))}
        </>
      )}
    </section>
  );
}
