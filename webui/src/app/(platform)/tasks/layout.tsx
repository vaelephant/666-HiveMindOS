import { TasksCenterShell } from '@/components/knowledge-base/tasks-center-shell';

export default function TasksLayout({ children }: { children: React.ReactNode }) {
  return <TasksCenterShell>{children}</TasksCenterShell>;
}
