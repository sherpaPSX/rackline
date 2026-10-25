import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { linearScale } from './scale.js';

export interface MeterProps {
  /** Called every animation frame; returns the current level in dBFS. */
  readLevel: () => number;
  floorDb?: number;
  /** Above this the meter turns amber. */
  warnDb?: number;
  /** Above this the meter turns red (limit / clip). */
  hotDb?: number;
  /** Peak hold fall-off per frame, in dB. */
  releaseDb?: number;
}

const prefersReducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Level meter. Draws outside React state: the bar is updated directly each
 * animation frame (about every 300 ms with reduced motion).
 */
export function Meter({ readLevel, floorDb = -60, warnDb = -12, hotDb = -3, releaseDb = 0.8 }: MeterProps) {
  const bar = useRef<HTMLElement>(null);
  const read = useRef(readLevel);
  useEffect(() => {
    read.current = readLevel;
  });

  useEffect(() => {
    const scale = linearScale(floorDb, 0);
    let shown = floorDb;
    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const slow = prefersReducedMotion();
    const draw = () => {
      shown = Math.max(read.current(), shown - releaseDb);
      if (bar.current) bar.current.style.height = `${scale.toPosition(shown) * 100}%`;
      if (slow) timer = setTimeout(draw, 300);
      else frame = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [floorDb, releaseDb]);

  const zones = linearScale(floorDb, 0);
  const style = {
    '--rl-warn-at': `${zones.toPosition(warnDb) * 100}%`,
    '--rl-hot-at': `${zones.toPosition(hotDb) * 100}%`,
  } as CSSProperties;
  return (
    <div className="rl-meter" aria-hidden="true" style={style}>
      <b ref={bar} />
    </div>
  );
}
