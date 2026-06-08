/** Chat 页全宽布局，侧栏历史与主内容区并排、各自独立滚动 */
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">{children}</div>
  );
}
