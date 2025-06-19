import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { getNodeLinks } from "~/lib/neo4j.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  if (!userId) return json([], { status: 400 });
  const nodeLinks = await getNodeLinks(userId);
  return json(nodeLinks);
}
