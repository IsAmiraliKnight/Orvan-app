const stroke = {
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

interface Shape {
  outline: React.ReactNode;
  /**
   * Whether the glyph reads correctly with a fill. Closed shapes do; the open
   * trend line on Growth would close into a blob, so it stays an outline and
   * leans on the weight bump instead.
   */
  fillable: boolean;
}

const SHAPES: Record<string, Shape> = {
  "/": {
    fillable: true,
    outline: <path d="M3 8.5 10 3l7 5.5V16a1 1 0 0 1-1 1h-3v-5H7v5H4a1 1 0 0 1-1-1Z" {...stroke} />,
  },
  "/calendar": {
    fillable: true,
    outline: (
      <>
        <rect x="3" y="4.5" width="14" height="12.5" rx="2" {...stroke} />
        <path d="M3 8.5h14M7 3v3M13 3v3" fill="none" {...stroke} />
      </>
    ),
  },
  "/projects": {
    fillable: true,
    outline: (
      <path
        d="M3 6a1.5 1.5 0 0 1 1.5-1.5h3L9 6.5h6.5A1.5 1.5 0 0 1 17 8v6.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5Z"
        {...stroke}
      />
    ),
  },
  "/finance": {
    fillable: true,
    outline: (
      <>
        <rect x="2.5" y="5.5" width="15" height="10" rx="2.5" {...stroke} />
        <circle cx="10" cy="10.5" r="2.2" fill="none" {...stroke} />
      </>
    ),
  },
  "/growth": {
    fillable: false,
    outline: <path d="M3.5 14.5 8 10l3 3 5.5-6M12 4.5h4.5V9" fill="none" {...stroke} />,
  },
  "/leaderboard": {
    fillable: true,
    outline: (
      <>
        <path d="M4 16.5h12" fill="none" {...stroke} />
        <rect x="4.5" y="9" width="3.5" height="7.5" rx="1.2" {...stroke} />
        <rect x="8.5" y="4.5" width="3.5" height="12" rx="1.2" {...stroke} />
        <rect x="12.5" y="11" width="3.5" height="5.5" rx="1.2" {...stroke} />
      </>
    ),
  },
  "/profile": {
    fillable: true,
    outline: (
      <>
        <circle cx="10" cy="7" r="2.8" {...stroke} />
        <path d="M4.5 16.5a5.5 5.5 0 0 1 11 0" {...stroke} />
      </>
    ),
  },
};

/**
 * One glyph set for both navigations, in two weights. Solid-when-selected is
 * the convention every phone OS uses, and it survives the moment a thumb is
 * covering the label.
 */
export function NavIcon({
  href,
  solid = false,
  className = "size-5",
}: {
  href: string;
  solid?: boolean;
  className?: string;
}) {
  const shape = SHAPES[href];
  if (!shape) return null;
  const filled = solid && shape.fillable;

  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <g
        fill={filled ? "currentColor" : "none"}
        fillOpacity={filled ? 0.24 : undefined}
        stroke="currentColor"
        strokeWidth={solid ? 1.9 : 1.6}
      >
        {shape.outline}
      </g>
    </svg>
  );
}
