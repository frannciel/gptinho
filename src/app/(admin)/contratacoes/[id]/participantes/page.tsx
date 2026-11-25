import { SrpPage } from "@/components/srp-page";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <SrpPage id={(await params).id} participants />;
}
