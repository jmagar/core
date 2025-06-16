import type { User } from "~/models/user.server";
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
  // console.log(user);
}
