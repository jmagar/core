import {
  type DeliverEmail,
  type SendPlainTextOptions,
  EmailClient,
  type MailTransportOptions,
} from "emails";

import { redirect } from "remix-typedjson";
import { env } from "~/env.server";
import type { AuthUser } from "./authUser";

import { logger } from "./logger.service";
import { singleton } from "~/utils/singleton";

const client = singleton(
  "email-client",
  () =>
    new EmailClient({
      transport: buildTransportOptions(),
      imagesBaseUrl: env.APP_ORIGIN,
      from: env.FROM_EMAIL ?? "team@core.heysol.ai",
      replyTo: env.REPLY_TO_EMAIL ?? "help@core.heysol.ai",
    }),
);

function buildTransportOptions(): MailTransportOptions {
  const transportType = env.EMAIL_TRANSPORT;
  logger.debug(
    `Constructing email transport '${transportType}' for usage general`,
  );

  switch (transportType) {
    case "aws-ses":
      return { type: "aws-ses" };
    case "resend":
      return {
        type: "resend",
        config: {
          apiKey: env.RESEND_API_KEY,
        },
      };
    case "smtp":
      return {
        type: "smtp",
        config: {
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE,
          auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASSWORD,
          },
        },
      };
    default:
      return { type: undefined };
  }
}

export async function sendMagicLinkEmail(options: any): Promise<void> {
  // Auto redirect when in development mode
  if (env.NODE_ENV === "development") {
    throw redirect(options.magicLink);
  }

  logger.debug("Sending magic link email", {
    emailAddress: options.emailAddress,
  });

  try {
    return await client.send({
      email: "magic_link",
      to: options.emailAddress,
      magicLink: options.magicLink,
    });
  } catch (error) {
    logger.error("Error sending magic link email", {
      error: JSON.stringify(error),
    });
    throw error;
  }
}

export async function sendPlainTextEmail(options: SendPlainTextOptions) {
  return client.sendPlainText(options);
}

export async function scheduleEmail(
  data: DeliverEmail,
  delay?: { seconds: number },
) {}

export async function sendEmail(data: DeliverEmail) {
  return client.send(data);
}
