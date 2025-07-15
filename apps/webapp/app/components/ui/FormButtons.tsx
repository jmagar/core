import { cn } from "~/lib/utils";

export function FormButtons({
  cancelButton,
  confirmButton,
  className,
}: {
  cancelButton?: React.ReactNode;
  confirmButton: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex w-full items-center justify-between pt-4", className)}
    >
      {cancelButton ? cancelButton : <div />} {confirmButton}
    </div>
  );
}
