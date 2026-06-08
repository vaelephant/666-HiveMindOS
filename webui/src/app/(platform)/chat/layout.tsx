/** Chat 页全宽布局，侧栏历史与主内容区并排 */
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-0 w-full flex-1 flex-col">{children}</div>;
}
