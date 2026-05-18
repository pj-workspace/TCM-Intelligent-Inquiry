/**
 * 路由占位：会话内容由 layout 内 HomePageClient + pathname 驱动。
 */
export default async function ChatConversationPage({
  params,
}: Readonly<{
  params: Promise<{ conversationId: string }>;
}>) {
  await params;
  return null;
}
