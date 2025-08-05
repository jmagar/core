import {
  RiDiscordFill,
  RiGithubFill,
  RiMailFill,
  RiSlackFill,
} from "@remixicon/react";
import { LayoutGrid } from "lucide-react";
import { LinearIcon, SlackIcon } from "./icons";
import { Cursor } from "./icons/cursor";
import { Claude } from "./icons/claude";
import { Cline } from "./icons/cline";
import { VSCode } from "./icons/vscode";

export const ICON_MAPPING = {
  slack: SlackIcon,
  email: RiMailFill,
  discord: RiDiscordFill,
  github: RiGithubFill,

  gmail: RiMailFill,
  linear: LinearIcon,
  cursor: Cursor,
  claude: Claude,
  cline: Cline,
  vscode: VSCode,

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
