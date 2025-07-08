import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/server-runtime";
import { useTypedLoaderData } from "remix-typedjson";
import { parse } from "@conform-to/zod";

import {
  requireUser,
  requireUserId,
  requireWorkpace,
} from "~/services/session.server";

import { ConversationNew } from "~/components/conversation";
import {
  createConversation,
  CreateConversationSchema,
} from "~/services/conversation.server";
import { json } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  // Only return userId, not the heavy nodeLinks
  const user = await requireUser(request);

  return { user };
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method.toUpperCase() !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const userId = await requireUserId(request);
  const workspace = await requireWorkpace(request);
  const formData = await request.formData();

  const submission = parse(formData, { schema: CreateConversationSchema });

  if (!submission.value || submission.intent !== "submit") {
    return json(submission);
  }

  const conversation = await createConversation(workspace?.id, userId, {
    message: submission.value.message,
    title: submission.value.title,
    conversationId: submission.value.conversationId,
  });

  // Redirect to the conversation page after creation
  // conversationId may be in different places depending on createConversation logic
  const conversationId = conversation?.conversationId;

  if (conversationId) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/home/conversation/${conversationId}`,
      },
    });
  }

  // fallback: just return the conversation object
  return json({ conversation });
}

export default function Chat() {
  const { user } = useTypedLoaderData<typeof loader>();

  return (
    <>{typeof window !== "undefined" && <ConversationNew user={user} />}</>
  );
}
