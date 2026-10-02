/** Shared palette + nib sizes for the practice drawing tools. */

// Dark, saturated inks that read clearly for the handwritten-answer vision model
// while still looking like pen/marker colours to the student.
export const DRAW_COLORS = [
  { name: "Ink", value: "#15171c" },
  { name: "Blue", value: "#1d4ed8" },
  { name: "Red", value: "#dc2626" },
  { name: "Green", value: "#15803d" },
  { name: "Amber", value: "#b45309" },
  { name: "Violet", value: "#7c3aed" },
] as const;

// nib widths in CSS px (thin → marker)
export const DRAW_SIZES = [2, 4, 7, 12] as const;

export const DEFAULT_DRAW_COLOR = DRAW_COLORS[0].value;
export const DEFAULT_DRAW_SIZE = DRAW_SIZES[1];
