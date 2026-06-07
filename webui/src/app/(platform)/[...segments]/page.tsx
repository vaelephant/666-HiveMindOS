import { notFound } from 'next/navigation';
import {
  getTitleFromSegments,
  isPlatformPathAllowed,
  PLATFORM_HOME_PATH,
} from '@/config/navigation';
import PlatformHomeDashboard from '@/components/platform/PlatformHomeDashboard';
import PlatformPagePlaceholder from '@/components/platform/PlatformPagePlaceholder';

type PageProps = {
  params: Promise<{ segments?: string[] }>;
};

export default async function PlatformCatchAllPage({ params }: PageProps) {
  const { segments: raw } = await params;
  const segments = raw ?? [];
  if (!isPlatformPathAllowed(segments)) {
    notFound();
  }
  const path = `/${segments.join('/')}`;
  if (path === PLATFORM_HOME_PATH) {
    return <PlatformHomeDashboard />;
  }
  const title = getTitleFromSegments(segments);
  return <PlatformPagePlaceholder title={title} path={path} segments={segments} />;
}
