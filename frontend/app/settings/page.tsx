import { SettingsPageClient } from "@/components/settings/SettingsPageClient";

export default async function SettingsPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<Record<string, string | string[] | undefined>>;
  searchParams: Promise<Record<string, string | string[] | string[][] | undefined>>;
}>) {
  await Promise.all([params, searchParams]);
  return <SettingsPageClient />;
}
