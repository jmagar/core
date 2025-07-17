import {
  RiDiscordFill,
  RiGithubFill,
  RiMailFill,
  RiSlackFill,
} from "@remixicon/react";
import { LayoutGrid } from "lucide-react";
import { LinearIcon, SlackIcon } from "./icons";

export const ICON_MAPPING = {
  slack: SlackIcon,
  email: RiMailFill,
  discord: RiDiscordFill,
  github: RiGithubFill,

  gmail: RiMailFill,
  linear: LinearIcon,

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
