import { Animated } from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";

/**
 * How retracted the tab bar is: 0 = resting, 1 = tucked away.
 *
 * A single shared Animated.Value rather than context or state — the bar has to
 * follow a finger, and anything that re-renders on scroll is visibly late.
 * Screens feed it through `onTabBarScroll`; the bar reads it directly.
 */
export const tabBarRetract = new Animated.Value(0);

let lastY = 0;
let settled = 0;

/** Ignores jitter; only a deliberate drag moves the bar. */
const THRESHOLD = 8;

export function onTabBarScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
  const y = e.nativeEvent.contentOffset.y;
  const delta = y - lastY;
  lastY = y;

  // Near the top the bar is always out — otherwise it can be left hidden on a
  // short list with nowhere to scroll back to.
  if (y < 40) {
    if (settled !== 0) {
      settled = 0;
      Animated.spring(tabBarRetract, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 2,
      }).start();
    }
    return;
  }

  if (delta > THRESHOLD && settled !== 1) {
    settled = 1;
    Animated.spring(tabBarRetract, {
      toValue: 1,
      useNativeDriver: true,
      bounciness: 2,
    }).start();
  } else if (delta < -THRESHOLD && settled !== 0) {
    settled = 0;
    Animated.spring(tabBarRetract, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 2,
    }).start();
  }
}

/**
 * Springs the bar back out. Called on tab change — switching screens with it
 * retracted would otherwise leave it small on a screen you never scrolled.
 */
export function expandTabBar() {
  lastY = 0;
  if (settled === 0) return;
  settled = 0;
  Animated.spring(tabBarRetract, {
    toValue: 0,
    useNativeDriver: true,
    bounciness: 2,
  }).start();
}

/** Hard reset, without animation, for unmount. */
export function resetTabBar() {
  lastY = 0;
  settled = 0;
  tabBarRetract.setValue(0);
}
