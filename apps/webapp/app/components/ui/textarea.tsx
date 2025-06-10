import React from "react";

import { useAutoSizeTextArea } from "../../hooks/use-autosize-textarea";
import { cn } from "../../lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, value, ...props }, ref) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textAreaRef = React.useRef<any>(ref);
    const id = React.useMemo(() => {
      return `id${Math.random().toString(16).slice(2)}`;
    }, []);

    useAutoSizeTextArea(id, textAreaRef.current, value);

    return (
      <textarea
        className={cn(
          "bg-input placeholder:text-muted-foreground focus-visible:ring-ring h-auto min-h-[30px] w-full rounded px-3 py-2 focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        id={id}
        ref={textAreaRef}
        contentEditable
        value={value}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
