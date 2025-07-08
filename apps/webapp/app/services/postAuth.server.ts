import type { User } from "~/models/user.server";
import { createWorkspace } from "~/models/workspace.server";
import { singleton } from "~/utils/singleton";

export async function postAuthentication({
  user,
  loginMethod,
  isNewUser,
}: {
  user: User;
  loginMethod: User["authenticationMethod"];
  isNewUser: boolean;
}) {
  if (user.name && isNewUser && loginMethod === "GOOGLE") {
    await createWorkspace({
      name: user.name,
      userId: user.id,
      integrations: [],
    });
  }
}
