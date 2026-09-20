import Svg, { Circle, Path, Polygon } from "react-native-svg";

/**
 * Tab glyphs drawn rather than taken from an icon font.
 *
 * Ionicons' equivalents are noticeably heavier and rounder than Instagram's,
 * which is what made the bar read as "not quite right" at any size. These use
 * a constant 1.8 stroke on a 24 grid with rounded caps, and fill the same path
 * when selected, so weight stays consistent across the set.
 */
type Props = { size?: number; color: string; filled?: boolean };

const STROKE = 1.8;

function base(size: number) {
  return { width: size, height: size, viewBox: "0 0 24 24" };
}

export function FeedIcon({ size = 24, color, filled }: Props) {
  return (
    <Svg {...base(size)}>
      <Circle
        cx={12}
        cy={12}
        r={9.2}
        stroke={color}
        strokeWidth={STROKE}
        fill={filled ? color : "none"}
      />
      <Polygon
        points="10.2,8.4 16.2,12 10.2,15.6"
        fill={filled ? "#000" : color}
        stroke={filled ? "#000" : color}
        strokeWidth={filled ? 0 : STROKE}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function DiscoverIcon({ size = 24, color, filled }: Props) {
  return (
    <Svg {...base(size)}>
      <Circle
        cx={12}
        cy={12}
        r={9.2}
        stroke={color}
        strokeWidth={STROKE}
        fill={filled ? color : "none"}
      />
      {/* The compass needle: two triangles meeting at the centre. */}
      <Path
        d="M15.6 8.4 L10.9 10.9 L8.4 15.6 L13.1 13.1 Z"
        fill={filled ? "#000" : color}
        stroke={filled ? "#000" : color}
        strokeWidth={filled ? 0 : 1.2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SearchIcon({ size = 24, color, filled }: Props) {
  return (
    <Svg {...base(size)}>
      <Circle
        cx={10.8}
        cy={10.8}
        r={7}
        stroke={color}
        strokeWidth={filled ? STROKE + 0.7 : STROKE}
        fill="none"
      />
      <Path
        d="M16 16 L21 21"
        stroke={color}
        strokeWidth={filled ? STROKE + 0.7 : STROKE}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function ActivityIcon({ size = 24, color, filled }: Props) {
  return (
    <Svg {...base(size)}>
      <Path
        d="M12 20.4 C12 20.4 2.8 15.2 2.8 8.9 C2.8 6.1 5 4 7.6 4 C9.4 4 11 5 12 6.5 C13 5 14.6 4 16.4 4 C19 4 21.2 6.1 21.2 8.9 C21.2 15.2 12 20.4 12 20.4 Z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinejoin="round"
        fill={filled ? color : "none"}
      />
    </Svg>
  );
}

export function ProfileIcon({ size = 24, color, filled }: Props) {
  return (
    <Svg {...base(size)}>
      <Circle
        cx={12}
        cy={8}
        r={4}
        stroke={color}
        strokeWidth={STROKE}
        fill={filled ? color : "none"}
      />
      <Path
        d="M4.4 20.2 C4.4 16.3 7.8 14 12 14 C16.2 14 19.6 16.3 19.6 20.2"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        fill={filled ? color : "none"}
      />
    </Svg>
  );
}
