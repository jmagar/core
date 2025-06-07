import type { Prisma, User } from "@core/database";
import type { GoogleProfile } from "@coji/remix-auth-google";
import { prisma } from "~/db.server";
export type { User } from "@core/database";

type FindOrCreateGoogle = {
  authenticationMethod: "GOOGLE";
  email: User["email"];
  authenticationProfile: GoogleProfile;
  authenticationExtraParams: Record<string, unknown>;
};

type FindOrCreateUser = FindOrCreateGoogle;

type LoggedInUser = {
  user: User;
  isNewUser: boolean;
};

export async function findOrCreateUser(
  input: FindOrCreateUser,
): Promise<LoggedInUser> {
  return findOrCreateGoogleUser(input);
}

export async function findOrCreateGoogleUser({
  email,
  authenticationProfile,
  authenticationExtraParams,
}: FindOrCreateGoogle): Promise<LoggedInUser> {
  const name = authenticationProfile._json.name;
  let avatarUrl: string | undefined = undefined;
  if (authenticationProfile.photos[0]) {
    avatarUrl = authenticationProfile.photos[0].value;
  }
  const displayName = authenticationProfile.displayName;
  const authProfile = authenticationProfile
    ? (authenticationProfile as unknown as Prisma.JsonObject)
    : undefined;
  const authExtraParams = authenticationExtraParams
    ? (authenticationExtraParams as unknown as Prisma.JsonObject)
    : undefined;

  const authIdentifier = `github:${authenticationProfile.id}`;

  const existingUser = await prisma.user.findUnique({
    where: {
      authIdentifier,
    },
  });

  const existingEmailUser = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (existingEmailUser && !existingUser) {
    const user = await prisma.user.update({
      where: {
        email,
      },
      data: {
        authenticationProfile: authProfile,
        authenticationExtraParams: authExtraParams,
        avatarUrl,
        authIdentifier,
      },
    });

    return {
      user,
      isNewUser: false,
    };
  }

  if (existingEmailUser && existingUser) {
    const user = await prisma.user.update({
      where: {
        id: existingUser.id,
      },
      data: {},
    });

    return {
      user,
      isNewUser: false,
    };
  }

  const user = await prisma.user.upsert({
    where: {
      authIdentifier,
    },
    update: {},
    create: {
      authenticationProfile: authProfile,
      authenticationExtraParams: authExtraParams,
      name,
      avatarUrl,
      displayName,
      authIdentifier,
      email,
      authenticationMethod: "GOOGLE",
    },
  });

  return {
    user,
    isNewUser: !existingUser,
  };
}

export async function getUserById(id: User["id"]) {
  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    return null;
  }

  return {
    ...user,
  };
}

export async function getUserByEmail(email: User["email"]) {
  return prisma.user.findUnique({ where: { email } });
}

export function updateUser({
  id,
  name,
  email,
  marketingEmails,
  referralSource,
}: Pick<User, "id" | "name" | "email"> & {
  marketingEmails?: boolean;
  referralSource?: string;
}) {
  return prisma.user.update({
    where: { id },
    data: {
      name,
      email,
      marketingEmails,
      referralSource,
      confirmedBasicDetails: true,
    },
  });
}

export async function grantUserCloudAccess({
  id,
  inviteCode,
}: {
  id: string;
  inviteCode: string;
}) {
  return prisma.user.update({
    where: { id },
    data: {
      InvitationCode: {
        connect: {
          code: inviteCode,
        },
      },
    },
  });
}
