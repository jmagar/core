import { createCookieSessionStorage } from "@remix-run/node";
import { createThemeSessionResolver } from "remix-themes";
import { env } from "~/env.server";

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session", // use any name you want here
    sameSite: "lax", // this helps with CSRF
    path: "/", // remember to add this so the cookie will work in all routes
    httpOnly: true, // for security reasons, make this cookie http only
    secrets: [env.SESSION_SECRET],
    secure: env.NODE_ENV === "production", // enable this in prod only
    maxAge: 60 * 60 * 24 * 365, // 7 days
  },
});

export const themeStorage = createCookieSessionStorage({
  cookie: {
    name: "__theme",
    sameSite: "lax",
    path: "/",
    httpOnly: true,
    secrets: [env.SESSION_SECRET],
    secure: env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  },
});

export const themeSessionResolver = createThemeSessionResolver(sessionStorage);

export function getUserSession(request: Request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}

export const { getSession, commitSession, destroySession } = sessionStorage;
