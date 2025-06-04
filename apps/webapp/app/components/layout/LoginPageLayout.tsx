import { Button } from "../ui";
import Logo from "../logo/logo";
import { Theme, useTheme } from "remix-themes";

export function LoginPageLayout({ children }: { children: React.ReactNode }) {
  const [, setTheme] = useTheme();

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center">
      <div className="pt-8">
        <Logo width={5} height={5} />
        <Button onClick={() => setTheme(Theme.DARK)}>theme</Button>
      </div>

      <div className="flex h-full flex-grow items-center justify-center">
        {children}
      </div>
    </div>
  );
}
