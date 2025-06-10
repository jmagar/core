import { Button } from "../ui";
import Logo from "../logo/logo";
import { Theme, useTheme } from "remix-themes";

export function LoginPageLayout({ children }: { children: React.ReactNode }) {
  const [, setTheme] = useTheme();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <a href="#" className="flex items-center gap-2 self-center font-medium">
          <div className="bg-background-3 flex size-6 items-center justify-center rounded-md">
            <Logo width={20} height={20} />
          </div>
          <div className="font-mono">C.O.R.E.</div>
        </a>
        {children}
      </div>
    </div>
  );
}
