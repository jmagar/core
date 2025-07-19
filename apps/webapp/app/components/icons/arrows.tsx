import type { IconProps } from "./types";

export function Arrows({ size = 18, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="lch(38.893% 1 282.863 / 1)"
      role="img"
      focusable="false"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M5.378 7.5a.6.6 0 0 1 .6.6l-.002 1.774c2.375.224 8.027.917 8.027 1.328 0 .311-2.675.796-8.024 1.453l-.001 1.747a.6.6 0 0 1-.992.454L1.14 11.548a.4.4 0 0 1 0-.607l3.848-3.297a.6.6 0 0 1 .39-.144Zm4.79-6.291a.6.6 0 0 1 .846-.064l3.847 3.309a.4.4 0 0 1 0 .607l-3.848 3.296a.6.6 0 0 1-.99-.455V6.128C7.65 5.904 1.998 5.21 1.998 4.799c0-.31 2.675-.795 8.024-1.452l.001-1.747a.6.6 0 0 1 .145-.391Z"></path>
    </svg>
  );
}
