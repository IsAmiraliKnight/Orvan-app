/**
 * Colour categories for tasks, in the shape iOS Calendar uses: the colour *is*
 * the category, so there is no second taxonomy to manage and no empty
 * "create a category first" step before a user can tag anything.
 *
 * Projects keep their own colour and are capped at two on Free, which is why
 * this cannot simply reuse them — people need more buckets than projects.
 */

export interface Swatch {
  key: string;
  /** Editable in a later pass; the default names cover the common buckets. */
  name: string;
  color: string;
  pro: boolean;
}

export const PALETTE: readonly Swatch[] = [
  { key: "sage", name: "Work", color: "#2ea98c", pro: false },
  { key: "amber", name: "Personal", color: "#ffc53d", pro: false },
  { key: "coral", name: "Health", color: "#ff7a45", pro: false },
  { key: "azure", name: "Learning", color: "#4c8dff", pro: false },
  { key: "violet", name: "Social", color: "#a97dff", pro: false },

  // Pro. Shown, not hidden — the lock is the pitch.
  { key: "rose", name: "Family", color: "#ff6b9d", pro: true },
  { key: "lime", name: "Errands", color: "#9ccc3c", pro: true },
  { key: "slate", name: "Admin", color: "#7c8e98", pro: true },
  { key: "clay", name: "Home", color: "#c98a5e", pro: true },
];

export const FREE_SWATCHES = PALETTE.filter((s) => !s.pro);

export function swatch(key: string | undefined): Swatch | undefined {
  return key ? PALETTE.find((s) => s.key === key) : undefined;
}

export function swatchColor(key: string | undefined): string | undefined {
  return swatch(key)?.color;
}

/**
 * A translucent fill of the category colour, so a tinted row still sits on the
 * theme's surface instead of punching a saturated block through it.
 */
export function tint(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}
