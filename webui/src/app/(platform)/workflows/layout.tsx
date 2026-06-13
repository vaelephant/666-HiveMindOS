export default function WorkflowsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col px-6 md:px-8 lg:px-10">
      {children}
    </div>
  );
}
