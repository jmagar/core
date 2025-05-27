import { useEffect, useState } from "react";
import { Paragraph } from "../ui/Paragraph";
import { Header3 } from "../ui/Headers";
import { Button } from "../ui";
import Logo from "../logo/logo";
import { Theme, useTheme } from "remix-themes";

interface QuoteType {
  quote: string;
}

const quotes: QuoteType[] = [
  {
    quote:
      "Recall remembers that I prefer emails in dark mode and hate promotional content. It automatically filters and formats my communications just the way I like.",
  },
  {
    quote:
      "When I mention liking Nike's latest running shoes, Recall remembers this preference and helps surface relevant product launches and deals across my browsing.",
  },
  {
    quote:
      "Echo knows I'm a vegetarian and helps filter restaurant recommendations and recipes accordingly, without me having to specify it every time.",
  },
  {
    quote:
      "By remembering that I prefer technical documentation with code examples, Echo helps prioritize learning resources that match my learning style.",
  },
];

export function LoginPageLayout({ children }: { children: React.ReactNode }) {
  const [randomQuote, setRandomQuote] = useState<QuoteType | null>(null);
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * quotes.length);
    setRandomQuote(quotes[randomIndex]);
  }, []);
  const [, setTheme] = useTheme();

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center">
      <div className="pt-8">
        <Logo width={20} height={20} />
        <Button onClick={() => setTheme(Theme.DARK)}>theme</Button>
      </div>

      <div className="flex h-full flex-grow items-center justify-center">
        {children}
      </div>
    </div>
  );
}
