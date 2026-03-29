import { redirect } from "next/navigation";

export default async function PerformancesPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const city = typeof params.city === "string" ? params.city : "";
  const status = typeof params.status === "string" ? params.status : "";
  const troupe = typeof params.troupe === "string" ? params.troupe : "";
  const person = typeof params.person === "string" ? params.person : "";
  const work = typeof params.work === "string" ? params.work : "";
  const venue = typeof params.venue === "string" ? params.venue : "";
  const redirectParams = new URLSearchParams();
  if (q) redirectParams.set("q", q);
  if (city) redirectParams.set("city", city);
  if (status) redirectParams.set("status", status);
  if (troupe) redirectParams.set("troupe", troupe);
  if (person) redirectParams.set("person", person);
  if (work) redirectParams.set("work", work);
  if (venue) redirectParams.set("venue", venue);

  redirect(`/events${redirectParams.toString() ? `?${redirectParams.toString()}` : ""}`);
}
