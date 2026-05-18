import { redirect } from "next/navigation";

/** /chat/folder 缺少 groupId */
export default function ChatFolderIndexPage() {
  redirect("/chat");
}
