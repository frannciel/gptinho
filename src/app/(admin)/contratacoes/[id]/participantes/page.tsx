import { SrpPage } from "@/components/srp-page";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <SrpPage id={(await params).id} query={await searchParams} participants />
  );
}
