import { OpportunityEditor } from "@/components/opportunity-editor";
export const metadata = { title: "Editar oportunidade" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OpportunityEditor id={id} />;
}
