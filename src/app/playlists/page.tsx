import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import PlaylistsClient from "./PlaylistsClient";

export default async function PlaylistsPage() {
  const session = await getSession();
  if (!session) redirect("/");
  return <PlaylistsClient />;
}
