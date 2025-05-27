import { type LoaderFunctionArgs } from "@remix-run/node";
import { useNavigation } from "@remix-run/react";
import { typedjson } from "remix-typedjson";
import { LoginPageLayout } from "~/components/layout/LoginPageLayout";
import { authenticator } from "~/services/auth.server";
import {
  commitSession,
  getUserSession,
} from "~/services/sessionStorage.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticator.isAuthenticated(request, {
    successRedirect: "/",
  });

  const session = await getUserSession(request);

  return typedjson({
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export default function LoginPage() {
  const navigate = useNavigation();

  return (
    <LoginPageLayout>
      <h2>Lohin</h2>
    </LoginPageLayout>
  );
}
