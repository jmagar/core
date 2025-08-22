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

export const getIconForAuthorise = (name: string, image?: string) => {
  if (image) {
    return <img src={image} alt={name} className="h-[40px] w-[40px] rounded" />;
  }

  const lowerName = name.toLowerCase();

  if (lowerName in ICON_MAPPING) {
    const IconComponent = ICON_MAPPING[lowerName as IconType];

    return <IconComponent size={40} />;
  }

  return <LayoutGrid size={40} />;
};
