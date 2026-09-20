import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

/**
 * A soft scrim behind floating UI, so the header and tab bar stay readable
 * over any artwork or video.
 *
 * Drawn with react-native-svg rather than expo-linear-gradient because svg is
 * already in the binary — a gradient library would mean another native
 * rebuild for something purely cosmetic.
 */
export function Fade({
  direction,
  height,
  opacity = 0.85,
  style,
}: {
  direction: "top" | "bottom";
  height: number;
  opacity?: number;
  style?: object;
}) {
  const id = `fade-${direction}`;
  // Top fades from solid at the screen edge down to nothing; bottom is the
  // mirror of that.
  const from = direction === "top" ? opacity : 0;
  const to = direction === "top" ? 0 : opacity;

  return (
    <Svg
      pointerEvents="none"
      width="100%"
      height={height}
      style={[{ position: "absolute", left: 0, right: 0 }, style]}
    >
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000" stopOpacity={from} />
          <Stop offset="0.55" stopColor="#000" stopOpacity={(from + to) / 2.6} />
          <Stop offset="1" stopColor="#000" stopOpacity={to} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height={height} fill={`url(#${id})`} />
    </Svg>
  );
}
