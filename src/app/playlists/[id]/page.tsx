import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import PlaylistDetailClient from "./PlaylistDetailClient";

export default async function PlaylistDetailPage({
  params,
}: PageProps<"/playlists/[id]">) {
  const session = await getSession();
  if (!session) redirect("/");
  const { id } = await params;
  return <PlaylistDetailClient playlistId={id} />;
}
