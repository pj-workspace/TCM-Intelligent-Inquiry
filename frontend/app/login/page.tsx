import { LoginPageClient } from "./login-client";

export default async function LoginPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<Record<string, string | string[] | undefined>>;
  searchParams: Promise<Record<string, string | string[] | string[][] | undefined>>;
}>) {
  await Promise.all([params, searchParams]);
  return <LoginPageClient />;
}
