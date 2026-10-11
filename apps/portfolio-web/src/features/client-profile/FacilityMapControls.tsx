/* eslint-disable @next/next/no-img-element */
import styles from "./facility-map.module.css";
export function FacilityMapControls({
  scale,
  zoom,
  pan,
  reset,
}: {
  scale: number;
  zoom: (delta: number) => void;
  pan: (x: number, y: number) => void;
  reset: () => void;
}) {
  return (
    <div className={styles.mapControls}>
      <button
        aria-label="Zoom in"
        onClick={() => zoom(0.5)}
        disabled={scale >= 5}
      >
        <img src="/design/411-47066-zoom-in.svg" alt="" />
      </button>
      <button
        aria-label="Zoom out"
        onClick={() => zoom(-0.5)}
        disabled={scale <= 1}
      >
        <img src="/design/411-47066-zoom-out.svg" alt="" />
      </button>
      <button aria-label="Pan left" onClick={() => pan(-40, 0)}>
        ←
      </button>
      <button aria-label="Pan right" onClick={() => pan(40, 0)}>
        →
      </button>
      <button aria-label="Reset map" onClick={reset}>
        ↺
      </button>
    </div>
  );
}
