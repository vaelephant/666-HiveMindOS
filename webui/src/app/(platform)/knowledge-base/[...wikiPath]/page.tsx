import { notFound, redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ wikiPath: string[] }>;
};

/** Deep links like `/knowledge-base/glossary/foo.md` → Wiki browser with query params. */
export default async function WikiDeepLinkPage({ params }: PageProps) {
  const { wikiPath } = await params;
  if (!wikiPath?.length) notFound();

  const category = wikiPath[0];
  const page = wikiPath.join('/');
  const search = new URLSearchParams({ category, page });
  redirect(`/knowledge-base/wiki?${search.toString()}`);
}
