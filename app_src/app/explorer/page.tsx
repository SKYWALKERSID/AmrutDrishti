'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import MapExplorer from '@/components/MapExplorer';

function ExplorerContent() {
  const searchParams = useSearchParams();
  const blockId = searchParams.get('block') || undefined;
  return <MapExplorer initialBlockId={blockId} />;
}

export default function ExplorerPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-text-muted">Loading Geospatial Explorer...</div>}>
      <ExplorerContent />
    </Suspense>
  );
}
