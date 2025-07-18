import { execSync } from "child_process";

export function getGitRemoteUrl(): string | null {
  try {
    const url = execSync("git config --get remote.origin.url", { encoding: "utf8" }).trim();
    return url;
  } catch {
    return null;
  }
}

export function isValidCoreRepo(): boolean {
  const remoteUrl = getGitRemoteUrl();
  if (!remoteUrl) return false;

  return (
    remoteUrl.includes("github.com/redplanethq/core") ||
    remoteUrl.includes("github.com:redplanethq/core") ||
    remoteUrl.includes("github.com/tegonhq/echo") ||
    remoteUrl.includes("github.com:tegonhq/echo")
  );
}
