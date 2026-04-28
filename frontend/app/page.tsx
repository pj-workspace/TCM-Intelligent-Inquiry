import { HomePageClient } from "@/components/home/HomePageClient";

/**
 * Next.js 16+：`params` / `searchParams` 为 Promise，须在服务端 await，勿在客户端或未 unwrap 时枚举。
 * 见 https://nextjs.org/docs/messages/sync-dynamic-apis
 */
export default async function Page({
  params,
  searchParams,
}: Readonly<{
  params: Promise<Record<string, string | string[] | undefined>>;
  searchParams: Promise<Record<string, string | string[] | string[][] | undefined>>;
}>) {
  await Promise.all([params, searchParams]);
  return <HomePageClient />;
}
