import { redirect } from "next/navigation";
export default async function GuestListPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  redirect("/" + locale + "/dashboard/wishlists/" + id);
}
