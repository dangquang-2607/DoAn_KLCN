import Analytics from "@/chuc-nang/bao-cao-tai-chinh/page";

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ period?: string | string[] }> }) {
  const { period } = await searchParams;
  return <Analytics initialPeriod={period === "week" ? "week" : "month"} />;
}
