/* Club colours. These are approximate home colours. Adjust any club you like.
   Clubs that are not listed get a stable colour generated from their name. */
const KNOWN: { match: (n: string) => boolean; colors: [string, string] }[] = [
  {
    match: (n) => n.includes("ahly") && !n.includes("bank"),
    colors: ["#c8102e", "#ffffff"],
  },
  { match: (n) => n.includes("zamalek"), colors: ["#f4f4f4", "#c8102e"] },
  { match: (n) => n.includes("pyramids"), colors: ["#5bb8e8", "#0b2a5b"] },
  { match: (n) => n.includes("masry"), colors: ["#0b8a3e", "#151515"] },
  { match: (n) => n.includes("ismaily"), colors: ["#f5c400", "#0a3a8a"] },
  { match: (n) => n.includes("ittihad"), colors: ["#0b7a3a", "#ffffff"] },
  { match: (n) => n.includes("smouha"), colors: ["#1e56c9", "#ffffff"] },
];

export function getTeamColors(teamName: string): {
  primary: string;
  secondary: string;
} {
  const name = teamName.toLowerCase();
  const known = KNOWN.find((k) => k.match(name));

  if (known) {
    return { primary: known.colors[0], secondary: known.colors[1] };
  }

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) % 360;
  }

  return {
    primary: `hsl(${hash} 55% 45%)`,
    secondary: `hsl(${(hash + 180) % 360} 20% 92%)`,
  };
}

export default function Shirt({
  team,
  number,
  className = "h-14 w-14",
}: {
  team: string;
  number?: number;
  className?: string;
}) {
  const { primary, secondary } = getTeamColors(team);

  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path
        d="M32 10 L8 26 L19 46 L29 40 L29 90 Q50 96 71 90 L71 40 L81 46 L92 26 L68 10 Q50 24 32 10 Z"
        fill={primary}
        stroke="rgba(0,0,0,0.4)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8 26 L19 46 L29 40 L29 30 Z" fill={secondary} opacity="0.92" />
      <path d="M92 26 L81 46 L71 40 L71 30 Z" fill={secondary} opacity="0.92" />
      <path
        d="M32 10 Q50 24 68 10"
        fill="none"
        stroke={secondary}
        strokeWidth="4"
        strokeLinecap="round"
      />
      {number !== undefined && (
        <text
          x="50"
          y="68"
          textAnchor="middle"
          fontSize="26"
          fontWeight="700"
          fill={secondary}
        >
          {number}
        </text>
      )}
    </svg>
  );
}
