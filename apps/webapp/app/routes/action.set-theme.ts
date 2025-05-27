import { createThemeAction } from "remix-themes";
import { themeSessionResolver } from "~/services/sessionStorage.server";

export const action = createThemeAction(themeSessionResolver);
