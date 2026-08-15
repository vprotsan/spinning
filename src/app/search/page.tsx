import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import SearchClient from "./SearchClient";

export default async function SearchPage() {
  const session = await getSession();
  if (!session) redirect("/");
  return <SearchClient />;
}
