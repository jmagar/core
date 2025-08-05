import React, { useMemo } from "react";
import CalendarHeatmap from "react-calendar-heatmap";
import { cn } from "~/lib/utils";

interface ContributionGraphProps {
  data: Array<{
    date: string;
    count: number;
    status?: string;
  }>;
  className?: string;
}

export function ContributionGraph({ data, className }: ContributionGraphProps) {
  const processedData = useMemo(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(endDate.getFullYear() - 1);

    return data.map((item) => ({
      date: item.date,
      count: item.count,
      status: item.status,
    }));
  }, [data]);

  const getClassForValue = (value: any) => {
    if (!value || value.count === 0) {
      return "fill-background dark:fill-background";
    }

    const count = value.count;
    if (count >= 20) return "fill-success";
    if (count >= 15) return "fill-success/85";
    if (count >= 10) return "fill-success/70";
    if (count >= 5) return "fill-success/50";
    return "fill-success/30";
  };

  const getTitleForValue = (value: any) => {
    if (!value || value.count === 0) {
      return `No activity on ${value?.date || "this date"}`;
    }

    const count = value.count;
    const date = new Date(value.date).toLocaleDateString();
    return `${count} ${count === 1 ? "activity" : "activities"} on ${date}`;
  };

  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(endDate.getFullYear() - 1);

  return (
    <div className={cn("flex w-full flex-col justify-center", className)}>
      <div className="overflow-x-auto rounded-lg">
        <CalendarHeatmap
          startDate={startDate}
          endDate={endDate}
          values={processedData}
          classForValue={getClassForValue}
          titleForValue={getTitleForValue}
          showWeekdayLabels={true}
          showMonthLabels={true}
          gutterSize={2}
          horizontal={true}
        />
      </div>
    </div>
  );
}
