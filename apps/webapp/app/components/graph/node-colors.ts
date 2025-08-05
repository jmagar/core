// Define a color palette for node coloring using hex values directly
export const nodeColorPalette = {
  light: [
    "#b56455", // Entity (default)
    "#7b8a34",
    "#1c91a8",
    "#886dbc",
    "#ad6e30",
    "#54935b",
    "#4187c0",
    "#a165a1",
    "#997d1d",
    "#2b9684",
    "#2b9684",
    "#b0617c",
  ],
  dark: [
    "#b56455", // Entity (default)
    "#7b8a34",
    "#1c91a8",
    "#886dbc",
    "#ad6e30",
    "#54935b",
    "#4187c0",
    "#a165a1",
    "#997d1d",
    "#2b9684",
    "#2b9684",
    "#b0617c",
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
