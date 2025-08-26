import { PageHeader } from "~/components/common/page-header";
import { type LoaderFunctionArgs } from "@remix-run/server-runtime";
import { requireUserId } from "~/services/session.server";
import { ClientOnly } from "remix-utils/client-only";
import { SpaceService } from "~/services/space.server";
import { useTypedLoaderData } from "remix-typedjson";
import { Outlet, useLocation, useNavigate } from "@remix-run/react";
import { SpaceOptions } from "~/components/spaces/space-options";
import { LoaderCircle } from "lucide-react";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);

  const spaceService = new SpaceService();

  const spaceId = params.spaceId; // Get spaceId from URL params
  const space = await spaceService.getSpace(spaceId as string, userId);

  return space;
}

export default function Space() {
  const space = useTypedLoaderData<typeof loader>();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <>
      <PageHeader
        title="Space"
        breadcrumbs={[
          { label: "Spaces", href: "/home/space" },
          {
            label: (
              <div className="flex items-center gap-2">
                <span>{space?.name || "Untitled"}</span>
              </div>
            ),
          },
        ]}
        tabs={[
          {
            label: "Overview",
            value: "overview",
            isActive: location.pathname.includes("/overview"),
            onClick: () => navigate(`/home/space/${space.id}/overview`),
          },
          {
            label: "Facts",
            value: "facts",
            isActive: location.pathname.includes("/facts"),
            onClick: () => navigate(`/home/space/${space.id}/facts`),
          },
          {
            label: "Patterns",
            value: "patterns",
            isActive: location.pathname.includes("/patterns"),
            onClick: () => navigate(`/home/space/${space.id}/patterns`),
          },
        ]}
        actionsNode={
          <ClientOnly
            fallback={
              <div>
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              </div>
            }
          >
            {() => (
              <SpaceOptions
                id={space.id as string}
                name={space.name}
                description={space.description}
              />
            )}
          </ClientOnly>
        }
      />
      <div className="relative flex h-[calc(100vh_-_56px)] w-full flex-col items-center justify-start overflow-auto">
        <Outlet />
      </div>
    </>
  );
}
