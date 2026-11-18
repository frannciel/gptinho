import {
  OrganizationList,
  type SearchParams,
} from "@/components/organization-list";
export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return <OrganizationList role="PUBLIC_AGENCY" searchParams={searchParams} />;
}
