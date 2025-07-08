import { type GraphVisualizationProps } from "./graph-visualization";
import { useState, useEffect } from "react";

export function GraphVisualizationClient(props: GraphVisualizationProps) {
  const [Component, setComponent] = useState<any>(undefined);

  useEffect(() => {
    if (typeof window === "undefined") return;

    import("./graph-visualization").then(({ GraphVisualization }) => {
      setComponent(GraphVisualization);
    });
  }, []);

  if (!Component) {
    return null;
  }

  return <Component {...props} />;
}
