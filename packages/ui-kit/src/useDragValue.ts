import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, RefObject } from 'react';
import { clamp } from './scale.js';
import type { ValueScale } from './scale.js';

export interface DragOptions {
  scale: ValueScale;
  defaultValue: number;
  /** Pixels of vertical drag for the full range. */
  dragRange?: number;
  /** Position change per arrow key press or wheel notch. */
  step?: number;
}

/** Holding Shift slows dragging, keys and wheel down to this factor. */
const FINE = 0.1;

const KEY_STEPS: Record<string, number> = {
  ArrowUp: 1,
  ArrowRight: 1,
  ArrowDown: -1,
  ArrowLeft: -1,
  PageUp: 10,
  PageDown: -10,
};

/**
 * Shared behaviour of knobs, faders and value boxes: vertical drag, Shift for
 * fine control, double click for the default, arrow/Page/Home/End keys.
 * The mouse wheel only changes the value while the control has focus, so
 * scrolling the page during a show never moves anything.
 */
export function useDragValue<E extends HTMLElement | SVGElement>(
  value: number,
  onChange: (value: number) => void,
  { scale, defaultValue, dragRange = 150, step = 0.01 }: DragOptions,
) {
  const [active, setActive] = useState(false);
  const ref = useRef<E>(null);
  const start = useRef({ y: 0, position: 0 });
  const latest = useRef({ value, onChange, scale });
  useEffect(() => {
    latest.current = { value, onChange, scale };
  });

  const position = scale.toPosition(value);
  const setPosition = (p: number) => {
    const { onChange: emit, scale: s } = latest.current;
    emit(s.fromPosition(clamp(p, 0, 1)));
  };
  const nudge = (delta: number) => setPosition(latest.current.scale.toPosition(latest.current.value) + delta);
  const nudgeRef = useRef(nudge);
  useEffect(() => {
    nudgeRef.current = nudge;
  });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const onWheel = (e: Event) => {
      if (document.activeElement !== node || !(e instanceof WheelEvent)) return;
      e.preventDefault();
      nudgeRef.current((e.deltaY < 0 ? 1 : -1) * step * (e.shiftKey ? FINE : 1));
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [step]);

  const props = {
    ref: ref as RefObject<E | null>,
    tabIndex: 0,
    onPointerDown(e: PointerEvent<E>) {
      e.currentTarget.setPointerCapture(e.pointerId);
      start.current = { y: e.clientY, position };
      setActive(true);
      e.currentTarget.focus();
    },
    onPointerMove(e: PointerEvent<E>) {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      // Incremental, so pressing Shift mid-drag does not make the value jump.
      const dy = start.current.y - e.clientY;
      const p = clamp(start.current.position + (dy / dragRange) * (e.shiftKey ? FINE : 1), 0, 1);
      start.current = { y: e.clientY, position: p };
      setPosition(p);
    },
    onLostPointerCapture() {
      setActive(false);
    },
    onDoubleClick() {
      latest.current.onChange(defaultValue);
    },
    onKeyDown(e: KeyboardEvent<E>) {
      if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        setPosition(e.key === 'Home' ? 0 : 1);
        return;
      }
      const k = KEY_STEPS[e.key];
      if (k === undefined) return;
      e.preventDefault();
      nudge(k * step * (e.shiftKey ? FINE : 1));
    },
  };

  return { active, position, props };
}
