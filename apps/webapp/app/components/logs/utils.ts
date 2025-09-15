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
