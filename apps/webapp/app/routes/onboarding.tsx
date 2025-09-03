import { z } from "zod";
import { useLoaderData, useActionData, useNavigate } from "@remix-run/react";
import {
  type ActionFunctionArgs,
  json,
  type LoaderFunctionArgs,
  redirect,
  createCookie,
} from "@remix-run/node";
import { useForm } from "@conform-to/react";
import { getFieldsetConstraint, parse } from "@conform-to/zod";
import { LoginPageLayout } from "~/components/layout/login-page-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui";
import { Textarea } from "~/components/ui/textarea";
import { Input } from "~/components/ui/input";
import { useState } from "react";
import { requireUserId } from "~/services/session.server";
import { updateUser } from "~/models/user.server";
import { Copy, Check } from "lucide-react";
import { addToQueue } from "~/lib/ingest.server";
import { cn } from "~/lib/utils";
import { EpisodeTypeEnum } from "@core/types";

const ONBOARDING_STEP_COOKIE = "onboardingStep";
const onboardingStepCookie = createCookie(ONBOARDING_STEP_COOKIE, {
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  maxAge: 60 * 60 * 24 * 7, // 1 week
});

const schema = z.object({
  aboutUser: z
    .string()
    .min(
      10,
      "Please tell us a bit more about yourself (at least 10 characters)",
    )
    .max(1000, "Please keep it under 1000 characters"),
});

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);

  // Read step from cookie
  const cookieHeader = request.headers.get("Cookie");
  const cookie = (await onboardingStepCookie.parse(cookieHeader)) || {};
  const step = cookie.step || null;

  return json({ step });
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);

  const formData = await request.formData();
  const submission = parse(formData, { schema });

  if (!submission.value || submission.intent !== "submit") {
    return json(submission);
  }

  const { aboutUser } = submission.value;

  try {
    // Ingest memory via API call
    const memoryResponse = await addToQueue(
      {
        source: "Core",
        episodeBody: aboutUser,
        referenceTime: new Date().toISOString(),
        type: EpisodeTypeEnum.CONVERSATION,
      },
      userId,
    );

    if (!memoryResponse.id) {
      throw new Error("Failed to save memory");
    }

    // Update user's onboarding status
    await updateUser({
      id: userId,
      onboardingComplete: true,
    });

    // Set step in cookie and redirect to GET (PRG pattern)
    const cookie = await onboardingStepCookie.serialize({
      step: "memory-link",
    });
    return redirect("/onboarding", {
      headers: {
        "Set-Cookie": cookie,
      },
    });
  } catch (e: any) {
    return json({ errors: { body: e.message } }, { status: 400 });
  }
}

export default function Onboarding() {
  const loaderData = useLoaderData<{ step: string | null }>();
  const lastSubmission = useActionData<typeof action>();

  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [selectedSource, setSelectedSource] = useState<
    "Claude" | "Cursor" | "Other"
  >("Claude");

  const [form, fields] = useForm({
    lastSubmission: lastSubmission as any,
    constraint: getFieldsetConstraint(schema),
    onValidate({ formData }) {
      return parse(formData, { schema });
    },
  });

  const getMemoryUrl = (source: "Claude" | "Cursor" | "Other") => {
    const baseUrl = "https://core.heysol.ai/api/v1/mcp";
    return `${baseUrl}?Source=${source}`;
  };

  const memoryUrl = getMemoryUrl(selectedSource);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(memoryUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Show memory link step after successful submission (step persisted in cookie)
  if (loaderData.step === "memory-link") {
    return (
      <LoginPageLayout>
        <Card className="min-w-[400px] rounded-lg bg-transparent p-3 pt-1">
          <CardHeader className="flex flex-col items-start px-0">
            <CardTitle className="px-0 text-xl">Your Memory Link</CardTitle>
            <CardDescription className="text-md">
              Here's your personal memory API endpoint. Copy this URL to connect
              with external tools (Claude, Cursor etc).
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-2 text-base">
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="bg-grayAlpha-100 flex space-x-1 rounded-lg p-1">
                  {(["Claude", "Cursor", "Other"] as const).map((source) => (
                    <Button
                      key={source}
                      onClick={() => setSelectedSource(source)}
                      variant="ghost"
                      className={cn(
                        "flex-1 rounded-md px-3 py-1.5 transition-all",
                        selectedSource === source
                          ? "bg-accent text-accent-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {source}
                    </Button>
                  ))}
                </div>

                <div className="bg-background-3 flex items-center rounded">
                  <Input
                    type="text"
                    id="memoryUrl"
                    value={memoryUrl}
                    readOnly
                    className="bg-background-3 block w-full text-base"
                  />
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={copyToClipboard}
                    className="px-3"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="xl"
                className="w-full rounded-lg px-4 py-2"
                onClick={() => navigate("/")}
              >
                Continue to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </LoginPageLayout>
    );
  }

  return (
    <LoginPageLayout>
      <Card className="bg-background-2 w-full max-w-[400px] rounded-lg p-3 pt-1">
        <CardHeader className="flex flex-col items-start px-0"></CardHeader>

        <CardContent className="text-base">
          <form method="post" {...form.props}>
            <div className="space-y-4 pl-1">
              <CardTitle className="text-md mb-0 -ml-1 px-0 text-xl">
                Tell me about you
              </CardTitle>
              <div>
                <Textarea
                  id="aboutUser"
                  placeholder="I'm Steve Jobs, co-founder of Apple. I helped create the iPhone, iPad, and Mac. I'm passionate about design, technology, and making products that change the world. I spent much of my life in California, working on innovative devices and inspiring creativity. I enjoy simplicity, calligraphy, and thinking differently..."
                  name={fields.aboutUser.name}
                  className="block min-h-[120px] w-full bg-transparent px-0 text-base"
                  rows={10}
                />
                {fields.aboutUser.error && (
                  <div className="text-sm text-red-500">
                    {fields.aboutUser.error}
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="secondary"
                  size="xl"
                  className="rounded-lg px-4 py-2"
                >
                  Continue
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </LoginPageLayout>
  );
}
