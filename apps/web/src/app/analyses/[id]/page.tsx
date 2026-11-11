import { Suspense } from 'react';
import { Analyzer } from '@/components/Analyzer';

async function SavedAnalysis({ params }: PageProps<'/analyses/[id]'>) {
  const { id } = await params;
  return <Analyzer analysisId={id} />;
}

export default function AnalysisPage(props: PageProps<'/analyses/[id]'>) {
  return (
    <Suspense fallback={<p className="muted">Loading analysis…</p>}>
      <SavedAnalysis {...props} />
    </Suspense>
  );
}
