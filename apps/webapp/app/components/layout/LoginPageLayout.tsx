import { Button } from "../ui";
import Logo from "../logo/logo";
import { Theme, useTheme } from "remix-themes";

export function LoginPageLayout({ children }: { children: React.ReactNode }) {
  const [, setTheme] = useTheme();

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center">
      <div className="text-foreground flex flex-col items-center pt-8 font-mono">
        <Logo width={50} height={50} />
        C.O.R.E
      </div>

      <div className="flex h-full flex-grow items-center justify-center">
        {children}
      </div>
    </div>
  );
}
