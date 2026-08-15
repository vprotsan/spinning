import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import MySongsClient from "./MySongsClient";

export default async function MySongsPage() {
  const session = await getSession();
  if (!session) redirect("/");
  return <MySongsClient />;
}
