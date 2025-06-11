import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { type LoaderFunctionArgs } from "@remix-run/server-runtime";
import { IngestionLogsTable } from "~/components/logs";
import { getIngestionLogs } from "~/services/ingestionLogs.server";
import { requireUserId } from "~/services/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || 1);

  const { ingestionLogs, pagination } = await getIngestionLogs(userId, page);

  return json({ ingestionLogs, pagination });
}

export default function Logs() {
  const { ingestionLogs, pagination } = useLoaderData<typeof loader>();

  return (
    <div className="home flex h-full flex-col overflow-y-auto p-3">
      <div className="flex items-center justify-between">
        <div className="space-y-1 text-base">
          <h2 className="text-lg font-semibold">Logs</h2>
          <p className="text-muted-foreground">
            View and monitor your data ingestion logs. These logs show the
            history of data being loaded into memory, helping you track and
            debug the ingestion process.
          </p>
        </div>
      </div>

      <IngestionLogsTable ingestionLogs={ingestionLogs} />
      <div className="mt-4">
        {Array.from({ length: pagination.pages }, (_, i) => (
          <Link
            key={i + 1}
            to={`?page=${i + 1}`}
            className={`mx-1 rounded border px-2 py-1 ${
              pagination.currentPage === i + 1
                ? "bg-gray-200 font-bold"
                : "bg-white"
            }`}
          >
            {i + 1}
          </Link>
        ))}
      </div>
    </div>
  );
}
