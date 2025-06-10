import colors from "tailwindcss/colors";

// Define a color palette for node coloring
export const nodeColorPalette = {
  light: [
    "var(--custom-color-1)", // Entity (default)
    "var(--custom-color-2)",
    "var(--custom-color-3)",
    "var(--custom-color-4)",
    "var(--custom-color-5)",
    "var(--custom-color-6)",
    "var(--custom-color-7)",
    "var(--custom-color-8)",
    "var(--custom-color-9)",
    "var(--custom-color-10)",
    "var(--custom-color-11)",
    "var(--custom-color-12)",
  ],
  dark: [
    "var(--custom-color-1)", // Entity (default)
    "var(--custom-color-2)",
    "var(--custom-color-3)",
    "var(--custom-color-4)",
    "var(--custom-color-5)",
    "var(--custom-color-6)",
    "var(--custom-color-7)",
    "var(--custom-color-8)",
    "var(--custom-color-9)",
    "var(--custom-color-10)",
    "var(--custom-color-11)",
    "var(--custom-color-12)",
  ],
};

// Function to create a map of label to color index
export function createLabelColorMap(labels: string[]) {
  // Start with Entity mapped to first color
  const result = new Map<string, number>();
  result.set("Entity", 0);

  // Sort all non-Entity labels alphabetically for consistent color assignment
  const sortedLabels = labels
    .filter((label) => label !== "Entity")
    .sort((a, b) => a.localeCompare(b));

  // Map each unique label to a color index
  let nextIndex = 1;
  sortedLabels.forEach((label) => {
    if (!result.has(label)) {
      result.set(label, nextIndex % nodeColorPalette.light.length);
      nextIndex++;
    }
  });

  return result;
}

// Get color for a label directly
export function getNodeColor(
  label: string | null | undefined,
  isDarkMode: boolean,
  labelColorMap: Map<string, number>,
): string {
  if (!label) {
    return isDarkMode ? nodeColorPalette.dark[0] : nodeColorPalette.light[0];
  }

  // If label is "Entity" or not found in the map, return default color
  if (label === "Entity" || !labelColorMap.has(label)) {
    return isDarkMode ? nodeColorPalette.dark[0] : nodeColorPalette.light[0];
  }

  // Get the color index for this label
  const colorIndex = labelColorMap.get(label) || 0;

  // Return the color from the appropriate theme palette
  return isDarkMode
    ? nodeColorPalette.dark[colorIndex]
    : nodeColorPalette.light[colorIndex];
}
