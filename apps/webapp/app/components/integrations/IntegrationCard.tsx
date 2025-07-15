import React from "react";
import { Link } from "@remix-run/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { getIcon, type IconType } from "~/components/icon-utils";

interface IntegrationCardProps {
  integration: {
    id: string;
    name: string;
    description?: string;
    icon: string;
    slug?: string;
  };
  isConnected: boolean;
  onClick?: () => void;
  showDetail?: boolean;
}

export function IntegrationCard({
  integration,
  isConnected,
  onClick,
  showDetail = false,
}: IntegrationCardProps) {
  const Component = getIcon(integration.icon as IconType);

  const CardWrapper = showDetail ? Link : "div";
  const cardProps = showDetail
    ? { to: `/home/integration/${integration.slug || integration.id}` }
    : { onClick, className: "cursor-pointer" };

  return (
    <CardWrapper {...cardProps}>
      <Card className="transition-all hover:shadow-md">
        <CardHeader className="p-4">
          <div className="bg-background-2 mb-2 flex h-6 w-6 items-center justify-center rounded">
            <Component size={18} />
          </div>
          <CardTitle className="text-base">{integration.name}</CardTitle>
          <CardDescription className="line-clamp-2 text-xs">
            {integration.description || `Connect to ${integration.name}`}
          </CardDescription>
        </CardHeader>
        {isConnected && (
          <CardFooter className="p-3">
            <div className="flex w-full items-center justify-end">
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                Connected
              </span>
            </div>
          </CardFooter>
        )}
      </Card>
    </CardWrapper>
  );
}