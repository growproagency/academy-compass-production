import { useRef, useState, useCallback } from "react";

export type SwipeDirection = "left" | "right" | null;

interface SwipeGestureOptions {
  /** Minimum horizontal distance (px) to trigger a swipe. Default: 60 */
  threshold?: number;
  /** Maximum vertical drift (px) allowed before cancelling. Default: 80 */
  verticalThreshold?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

interface SwipeState {
  /** Current horizontal offset while swiping (used for visual feedback) */
  deltaX: number;
  /** Whether a swipe is currently in progress */
  isSwiping: boolean;
  /** Direction committed so far (null = undecided) */
  direction: SwipeDirection;
}

export function useSwipeGesture({
  threshold = 60,
  verticalThreshold = 80,
  onSwipeLeft,
  onSwipeRight,
}: SwipeGestureOptions) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const [swipeState, setSwipeState] = useState<SwipeState>({
    deltaX: 0,
    isSwiping: false,
    direction: null,
  });

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    setSwipeState({ deltaX: 0, isSwiping: false, direction: null });
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (startX.current === null || startY.current === null) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startX.current;
    const dy = Math.abs(touch.clientY - startY.current);

    // Cancel if vertical movement is dominant
    if (dy > verticalThreshold) {
      startX.current = null;
      setSwipeState({ deltaX: 0, isSwiping: false, direction: null });
      return;
    }

    // Only start tracking once past a small dead zone
    if (Math.abs(dx) > 8) {
      e.preventDefault(); // prevent scroll while swiping horizontally
      setSwipeState({
        deltaX: dx,
        isSwiping: true,
        direction: dx > 0 ? "right" : "left",
      });
    }
  }, [verticalThreshold]);

  const onTouchEnd = useCallback(() => {
    if (startX.current === null) return;
    const { deltaX } = swipeState;

    if (deltaX > threshold) {
      onSwipeRight?.();
      // Haptic feedback if supported
      if (navigator.vibrate) navigator.vibrate(30);
    } else if (deltaX < -threshold) {
      onSwipeLeft?.();
      if (navigator.vibrate) navigator.vibrate(30);
    }

    startX.current = null;
    startY.current = null;
    setSwipeState({ deltaX: 0, isSwiping: false, direction: null });
  }, [swipeState, threshold, onSwipeLeft, onSwipeRight]);

  return {
    swipeState,
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
  };
}
