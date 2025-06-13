import {
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";

import { Form, useNavigation } from "@remix-run/react";
import { Inbox, Loader, Mail } from "lucide-react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { z } from "zod";
import { LoginPageLayout } from "~/components/layout/LoginPageLayout";
import { Button } from "~/components/ui";
import { Fieldset } from "~/components/ui/Fieldset";
import { FormButtons } from "~/components/ui/FormButtons";
import { Header1 } from "~/components/ui/Headers";
import { Input } from "~/components/ui/input";
import { Paragraph } from "~/components/ui/Paragraph";
import { TextLink } from "~/components/ui/TextLink";

import { authenticator } from "~/services/auth.server";
import { getUserId } from "~/services/session.server";
import {
  commitSession,
  getUserSession,
} from "~/services/sessionStorage.server";
import { env } from "~/env.server";

export const meta: MetaFunction = ({ matches }) => {
  const parentMeta = matches
    .flatMap((match) => match.meta ?? [])
    .filter((meta) => {
      if ("title" in meta) return false;
      if ("name" in meta && meta.name === "viewport") return false;
      return true;
    });

  return [
    ...parentMeta,
    { title: `Login to C.O.R.E.` },
    {
      name: "viewport",
      content: "width=device-width,initial-scale=1",
    },
  ];
};

export async function loader({ request }: LoaderFunctionArgs): Promise<any> {
  if (!env.ENABLE_EMAIL_LOGIN) {
    return typedjson({ emailLoginEnabled: false });
  }

  const userId = await getUserId(request);
  if (userId) return redirect("/");

  const session = await getUserSession(request);
  const error = session.get("auth:error");

  let magicLinkError: string | undefined | unknown;
  if (error) {
    if ("message" in error) {
      magicLinkError = error.message;
    } else {
      magicLinkError = JSON.stringify(error, null, 2);
    }
  }

  return typedjson(
    {
      emailLoginEnabled: true,
      magicLinkSent: session.has("core:magiclink"),
      magicLinkError,
    },
    {
      headers: { "Set-Cookie": await commitSession(session) },
    },
  );
}

export async function action({ request }: ActionFunctionArgs) {
  if (!env.ENABLE_EMAIL_LOGIN) {
    throw new Error("Magic link login is not enabled");
  }

  const clonedRequest = request.clone();

  const payload = Object.fromEntries(await clonedRequest.formData());

  const { action } = z
    .object({
      action: z.enum(["send", "reset"]),
    })
    .parse(payload);

  if (action === "send") {
    return await authenticator.authenticate("email-link", request);
  } else {
    const session = await getUserSession(request);
    session.unset("core:magiclink");

    return redirect("/magic", {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    });
  }
}

export default function LoginMagicLinkPage() {
  const data = useTypedLoaderData<typeof loader>();
  const navigate = useNavigation();

  if (!data.emailLoginEnabled) {
    return (
      <LoginPageLayout>
        <Paragraph className="text-center">
          Magic link login is not enabled.
        </Paragraph>
      </LoginPageLayout>
    );
  }

  const isLoading =
    (navigate.state === "loading" || navigate.state === "submitting") &&
    navigate.formAction !== undefined &&
    navigate.formData?.get("action") === "send";

  return (
    <LoginPageLayout>
      <Form method="post">
        <div className="flex flex-col items-center justify-center">
          {data.magicLinkSent ? (
            <>
              <Header1 className="pb-6 text-center text-xl leading-7 font-normal md:text-xl lg:text-2xl">
                We've sent you a magic link!
              </Header1>
              <Fieldset className="flex w-full flex-col items-center gap-y-2">
                <Inbox className="text-primary mb-4 h-12 w-12" />
                <Paragraph className="mb-6 text-center">
                  We sent you an email which contains a magic link that will log
                  you in to your account.
                </Paragraph>
                <FormButtons
                  cancelButton={
                    <Button
                      type="submit"
                      name="action"
                      value="reset"
                      variant="link"
                      data-action="re-enter email"
                    >
                      Re-enter email
                    </Button>
                  }
                  confirmButton={
                    <Button
                      variant="ghost"
                      data-action="log in using another option"
                    >
                      Log in using another option
                    </Button>
                  }
                />
              </Fieldset>
            </>
          ) : (
            <>
              <Header1 className="pb-4 font-semibold sm:text-2xl md:text-3xl lg:text-4xl">
                Welcome
              </Header1>
              <Paragraph variant="base" className="mb-6 text-center">
                Create an account or login using email
              </Paragraph>
              <Fieldset className="flex w-full flex-col items-center gap-y-2">
                <Input
                  type="email"
                  name="email"
                  spellCheck={false}
                  placeholder="Email Address"
                  required
                  autoFocus
                />

                <Button
                  name="action"
                  value="send"
                  type="submit"
                  variant="secondary"
                  size="lg"
                  disabled={isLoading}
                  data-action="send a magic link"
                >
                  {isLoading ? (
                    <Loader className="mr-2 size-5" color="white" />
                  ) : (
                    <Mail className="text-text-bright mr-2 size-5" />
                  )}
                  {isLoading ? (
                    <span className="text-text-bright">Sending…</span>
                  ) : (
                    <span className="text-text-bright">Send a magic link</span>
                  )}
                </Button>
                {data.magicLinkError && <>{data.magicLinkError}</>}
              </Fieldset>
            </>
          )}
        </div>
      </Form>
    </LoginPageLayout>
  );
}
