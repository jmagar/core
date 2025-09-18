import { formatString } from "~/lib/utils";

export const getStatusColor = (status: string) => {
  switch (status) {
    case "PROCESSING":
      return "bg-blue-800";
    case "PENDING":
      return "bg-warning";
    case "COMPLETED":
      return "bg-success";
    case "FAILED":
      return "bg-destructive";
    case "CANCELLED":
      return "bg-gray-800";
    default:
      return "bg-gray-800";
  }
};

export function getStatusValue(status: string) {
  if (status === "PENDING") {
    return formatString("In Queue");
  }

  return status;
}
