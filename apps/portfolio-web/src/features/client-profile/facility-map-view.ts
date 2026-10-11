"use client";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

const arrowOffsets: Record<string, [number, number]> = {
  ArrowLeft: [-40, 0],
  ArrowRight: [40, 0],
  ArrowUp: [0, -40],
  ArrowDown: [0, 40],
};
/** Owns only map viewport measurement and transient pointer/keyboard view state. */
export function useFacilityMapView(ready: boolean) {
  const surface = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 720, height: 400 });
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null);
  useEffect(() => {
    if (!surface.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.width > 0 && entry.contentRect.height > 0)
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
    });
    observer.observe(surface.current);
    return () => observer.disconnect();
  }, [ready]);
  const pan = (x: number, y: number) =>
    setView((old) => ({ ...old, x: old.x + x, y: old.y + y }));
  const zoom = (delta: number) =>
    setView((old) => ({
      ...old,
      scale: Math.min(5, Math.max(1, old.scale + delta)),
    }));
  const reset = () => setView({ scale: 1, x: 0, y: 0 });
  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.target !== event.currentTarget) return;
    const offset = arrowOffsets[event.key];
    if (offset) {
      event.preventDefault();
      pan(...offset);
    }
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoom(0.5);
    }
    if (event.key === "-") {
      event.preventDefault();
      zoom(-0.5);
    }
  };
  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 || event.target !== event.currentTarget) return;
    pointer.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const drag = pointer.current;
    if (!drag || drag.id !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    pan(
      ((event.clientX - drag.x) * size.width) / rect.width,
      ((event.clientY - drag.y) * size.height) / rect.height,
    );
    drag.x = event.clientX;
    drag.y = event.clientY;
  };
  const finishPointer = () => {
    pointer.current = null;
  };
  return {
    surface,
    size,
    view,
    zoom,
    pan,
    reset,
    interaction: {
      onKeyDown,
      onPointerDown,
      onPointerMove,
      onPointerUp: finishPointer,
      onPointerCancel: finishPointer,
    },
  };
}
