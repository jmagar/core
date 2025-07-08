import { EditorContent, useEditor } from "@tiptap/react";

import React, { useEffect } from "react";
import { Document } from "@tiptap/extension-document";
import HardBreak from "@tiptap/extension-hard-break";
import { History } from "@tiptap/extension-history";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Text } from "@tiptap/extension-text";
import { UserTypeEnum } from "@core/types";
import { type ConversationHistory } from "@core/database";
import { cn } from "~/lib/utils";

interface AIConversationItemProps {
  conversationHistory: ConversationHistory;
}

export const ConversationItem = ({
  conversationHistory,
}: AIConversationItemProps) => {
  const isUser =
    conversationHistory.userType === UserTypeEnum.User ||
    conversationHistory.userType === UserTypeEnum.System;

  const id = `a${conversationHistory.id.replace(/-/g, "")}`;

  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      HardBreak.configure({
        keepMarks: true,
      }),
    ],
    editable: false,
    content: conversationHistory.message,
  });

  useEffect(() => {
    editor?.commands.setContent(conversationHistory.message);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, conversationHistory.message]);

  if (!conversationHistory.message) {
    return null;
  }

  return (
    <div className={cn("flex gap-2 px-4 pb-2", isUser && "my-4 justify-end")}>
      <div
        className={cn(
          "flex flex-col",
          isUser && "bg-primary/20 max-w-[500px] rounded-md p-3",
        )}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};
