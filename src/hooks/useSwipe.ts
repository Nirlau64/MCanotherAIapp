/**
 * Touch swipe hook for mobile gesture support.
 * Detects horizontal swipe direction and distance.
 */

import { useRef, useCallback, useState } from "react";

interface SwipeConfig {
  /** Minimum horizontal distance in px to trigger a swipe */
  threshold?: number;
  /** Maximum vertical deviation in px (prevents diagonal swipes) */
  maxVerticalDeviation?: number;
  /** Called when user swipes left past threshold */
  onSwipeLeft?: () => void;
  /** Called when user swipes right past threshold */
  onSwipeRight?: () => void;
}

interface SwipeState {
  /** Current horizontal offset (for animated transform) */
  offset: number;
  /** Whether a swipe action is being revealed */
  revealed: boolean;
}

export function useSwipe({
  threshold = 80,
  maxVerticalDeviation = 40,
  onSwipeLeft,
  onSwipeRight,
}: SwipeConfig = {}) {
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const swiping = useRef(false);
  const [state, setState] = useState<SwipeState>({ offset: 0, revealed: false });

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    currentX.current = 0;
    swiping.current = true;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping.current) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    // Cancel if too vertical
    if (Math.abs(dy) > maxVerticalDeviation) {
      swiping.current = false;
      setState({ offset: 0, revealed: false });
      return;
    }

    currentX.current = dx;
    // Clamp: only allow left swipe (negative), max threshold * 1.5
    const clamped = Math.max(-threshold * 1.5, Math.min(0, dx));
    setState({ offset: clamped, revealed: clamped <= -threshold * 0.5 });
  }, [threshold, maxVerticalDeviation]);

  const onTouchEnd = useCallback(() => {
    swiping.current = false;
    const dx = currentX.current;

    if (dx <= -threshold) {
      // Swiped left — trigger action, keep offset visible briefly
      setState({ offset: -threshold, revealed: true });
      onSwipeLeft?.();
      // Reset after delay
      setTimeout(() => setState({ offset: 0, revealed: false }), 300);
    } else if (dx >= threshold && onSwipeRight) {
      setState({ offset: threshold, revealed: true });
      onSwipeRight();
      setTimeout(() => setState({ offset: 0, revealed: false }), 300);
    } else {
      // Not enough — snap back
      setState({ offset: 0, revealed: false });
    }
  }, [threshold, onSwipeLeft, onSwipeRight]);

  return {
    /** Spread onto the touchable element */
    handlers: {
      onTouchStart,
      onTouchMove: onTouchMove as unknown as (e: React.TouchEvent) => void,
      onTouchEnd: onTouchEnd as unknown as (e: React.TouchEvent) => void,
    } as {
      onTouchStart: (e: React.TouchEvent) => void;
      onTouchMove: (e: React.TouchEvent) => void;
      onTouchEnd: (e: React.TouchEvent) => void;
    },
    style: {
      transform: `translateX(${state.offset}px)`,
      transition: swiping.current ? "none" : "transform 0.2s ease",
    } as React.CSSProperties,
    revealed: state.revealed,
    reset: () => setState({ offset: 0, revealed: false }),
  };
}
