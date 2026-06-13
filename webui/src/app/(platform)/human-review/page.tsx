import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { HumanReviewView } from '@/components/knowledge-base/human-review-view';

export default function HumanReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 py-24 text-shell-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
          加载人工审核…
        </div>
      }
    >
      <HumanReviewView />
    </Suspense>
  );
}
