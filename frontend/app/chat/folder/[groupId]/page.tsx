/**
 * 路由占位：分组工作台由 layout 内 HomePageClient + pathname 驱动。
 */
export default async function ChatFolderPage({
  params,
}: Readonly<{
  params: Promise<{ groupId: string }>;
}>) {
  await params;
  return null;
}
