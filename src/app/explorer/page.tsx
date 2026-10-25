'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import MapExplorer from '@/components/MapExplorer';
import { useLanguage } from '@/lib/context/LanguageContext';

function ExplorerLoading() {
  const { t } = useLanguage();
  return <div className="p-8 text-center text-xs text-text-muted">{t('explorer.loading', 'Loading Geospatial Explorer...')}</div>;
}

function ExplorerContent() {
  const searchParams = useSearchParams();
  const blockId = searchParams.get('block') || undefined;
  return <MapExplorer initialBlockId={blockId} />;
}

export default function ExplorerPage() {
  return (
    <Suspense fallback={<ExplorerLoading />}>
      <ExplorerContent />
    </Suspense>
  );
}
