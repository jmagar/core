import { type LoaderFunctionArgs } from "@remix-run/node";
import { Form } from "@remix-run/react";
import { redirect, typedjson, useTypedLoaderData } from "remix-typedjson";
import { LoginPageLayout } from "~/components/layout/LoginPageLayout";
import { Fieldset } from "~/components/ui/Fieldset";
import { Header1 } from "~/components/ui/Headers";
import { Paragraph } from "~/components/ui/Paragraph";
import { isGoogleAuthSupported } from "~/services/auth.server";
import { setRedirectTo } from "~/services/redirectTo.server";
import { getUserId } from "~/services/session.server";
import { commitSession } from "~/services/sessionStorage.server";
import { requestUrl } from "~/utils/requestUrl.server";

import { RiGoogleLine } from "@remixicon/react";

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
    <Form
      action={`/auth/google${data.redirectTo ? `?redirectTo=${data.redirectTo}` : ""}`}
      method="GET"
      className="w-full"
    >
      <div className="flex flex-col items-center">
        <Header1 className="pb-4 font-semibold sm:text-2xl md:text-3xl lg:text-4xl">
          Welcome
        </Header1>
        <Paragraph variant="base" className="mb-6">
          Create an account or login
        </Paragraph>
        <Fieldset className="w-full">
          <div className="flex flex-col gap-y-2">
            {data.showGoogleAuth && (
              <button type="submit" data-action="continue with google">
                <RiGoogleLine className={"mr-2 size-5"} />
                <span className="text-text-bright">Continue with Google</span>
              </button>
            )}
          </div>
        </Fieldset>
      </div>
    </Form>
  );
}
