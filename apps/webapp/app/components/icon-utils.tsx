import {
  RiDiscordFill,
  RiGithubFill,
  RiMailFill,
  RiSlackFill,
} from "@remixicon/react";
import { LayoutGrid } from "lucide-react";

export const ICON_MAPPING = {
  slack: RiSlackFill,
  email: RiMailFill,
  discord: RiDiscordFill,
  github: RiGithubFill,

  gmail: RiMailFill,

  // Default icon
  integration: LayoutGrid,
};

export type IconType = keyof typeof ICON_MAPPING;

export function getIcon(icon: IconType) {
  if (icon in ICON_MAPPING) {
    return ICON_MAPPING[icon];
  }

  return ICON_MAPPING["integration"];
}
