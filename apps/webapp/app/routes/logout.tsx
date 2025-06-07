import { type ActionFunction, type LoaderFunction } from "@remix-run/node";
import { redirect } from "remix-typedjson";

import { sessionStorage } from "~/services/sessionStorage.server";

export const action: ActionFunction = async ({ request }) => {
  let session = await sessionStorage.getSession(request.headers.get("cookie"));
  return redirect("/login", {
    headers: { "Set-Cookie": await sessionStorage.destroySession(session) },
  });
};

export const loader: LoaderFunction = async ({ request }) => {
  let session = await sessionStorage.getSession(request.headers.get("cookie"));
  return redirect("/login", {
    headers: { "Set-Cookie": await sessionStorage.destroySession(session) },
  });
};
