import { type Workspace } from "@core/database";
import { prisma } from "~/db.server";
import { sendEmail } from "~/services/email.server";
import { logger } from "~/services/logger.service";
import { SpaceService } from "~/services/space.server";

interface CreateWorkspaceDto {
  name: string;
  integrations: string[];
  userId: string;
}

const spaceService = new SpaceService();

const profileRule = `
Store the user’s stable, non-sensitive identity and preference facts that improve personalization across assistants. Facts must be long-lived (expected validity ≥ 3 months) and broadly useful across contexts (not app-specific).
Include (examples):
• Preferred name, pronunciation, public handles (GitHub/Twitter/LinkedIn URLs), primary email domain
• Timezone, locale, working hours, meeting preferences (async/sync bias, default duration)
• Role, team, company, office location (city-level only), seniority
• Tooling defaults (editor, ticketing system, repo host), keyboard layout, OS
• Communication preferences (tone, brevity vs. detail, summary-first)
Exclude: secrets/credentials; one-off or short-term states; health/financial/political/religious/sexual data; precise home address; raw event logs; app-specific analytics; anything the user did not explicitly consent to share.`;

export async function createWorkspace(
  input: CreateWorkspaceDto,
): Promise<Workspace> {
  const workspace = await prisma.workspace.create({
    data: {
      slug: input.name,
      name: input.name,
      userId: input.userId,
    },
  });

  const user = await prisma.user.update({
    where: { id: input.userId },
    data: {
      confirmedBasicDetails: true,
    },
  });

  await spaceService.createSpace({
    name: "Profile",
    description: profileRule,
    userId: input.userId,
    workspaceId: workspace.id,
  });

  try {
    await sendEmail({ email: "welcome", to: user.email });
  } catch (e) {
    logger.error("Error sending email");
  }

  return workspace;
}

export async function getWorkspaceByUser(userId: string) {
  return await prisma.workspace.findFirst({
    where: {
      userId,
    },
  });
}
