import { NodeViewWrapper } from "@tiptap/react";

import React from "react";

import { getIcon as iconUtil, type IconType } from "../../icon-utils";

import { ChevronDown, ChevronRight } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SkillComponent = (props: any) => {
  const id = props.node.attrs.id;
  const name = props.node.attrs.name;
  const agent = props.node.attrs.agent;
  const [open, setOpen] = React.useState(false);

  if (id === "undefined" || id === undefined || !name) {
    return null;
  }

  const getIcon = () => {
    const Icon = iconUtil(agent as IconType);

    return <Icon size={18} className="rounded-sm" />;
  };

  const snakeToTitleCase = (input: string): string => {
    if (!input) {
      return "";
    }

    const words = input.split("_");

    // First word: capitalize first letter
    const firstWord =
      words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase();

    // Rest of the words: all lowercase
    const restWords = words.slice(1).map((word) => word.toLowerCase());

    // Join with spaces
    return [firstWord, ...restWords].join(" ");
  };

  const getComponent = () => {
    return (
      <>
        <div className="bg-grayAlpha-100 text-sm-md mt-0.5 flex w-fit items-center gap-2 rounded p-2">
          {getIcon()}
          <span className="font-mono text-sm">{snakeToTitleCase(name)}</span>
        </div>
      </>
    );
  };

  return (
    <NodeViewWrapper className="inline w-fit">{getComponent()}</NodeViewWrapper>
  );
};
