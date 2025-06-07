import { type LoaderFunctionArgs } from "@remix-run/node";

import { redirect, typedjson, useTypedLoaderData } from "remix-typedjson";
import { LoginPageLayout } from "~/components/layout/LoginPageLayout";
import { Fieldset } from "~/components/ui/Fieldset";
import { isGoogleAuthSupported } from "~/services/auth.server";
import { setRedirectTo } from "~/services/redirectTo.server";
import { getUserId } from "~/services/session.server";
import { commitSession } from "~/services/sessionStorage.server";
import { requestUrl } from "~/utils/requestUrl.server";

import { RiGoogleLine } from "@remixicon/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await getUserId(request);
  if (userId) return redirect("/");

  const url = requestUrl(request);
  const redirectTo = url.searchParams.get("redirectTo");

  if (redirectTo) {
    const session = await setRedirectTo(request, redirectTo);

    return typedjson(
      { redirectTo, showGoogleAuth: isGoogleAuthSupported },
      {
        headers: {
          "Set-Cookie": await commitSession(session),
        },
      },
    );
  } else {
    return typedjson({
      redirectTo: null,
      showGoogleAuth: isGoogleAuthSupported,
    });
  }
}

export default function LoginPage() {
  const data = useTypedLoaderData<typeof loader>();

  return (
    <LoginPageLayout>
      <Card className="min-w-[300px] rounded-md p-3">
        <CardHeader className="flex flex-col items-start">
          <CardTitle>Login to your account</CardTitle>
          <CardDescription>Create an account or login</CardDescription>
        </CardHeader>

        <CardContent className="pt-2">
          <Fieldset className="w-full">
            <div className="flex flex-col gap-y-2">
              {data.showGoogleAuth && (
                <Button
                  type="submit"
                  size="lg"
                  variant="secondary"
                  className="rounded-lg text-base"
                  data-action="continue with google"
                  onClick={() => (window.location.href = "/auth/google")}
                >
                  <RiGoogleLine className={"mr-1 size-5"} />
                  <span>Continue with Google</span>
                </Button>
              )}
            </div>
          </Fieldset>
        </CardContent>
      </Card>
    </LoginPageLayout>
  );
}
