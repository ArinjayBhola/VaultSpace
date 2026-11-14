'use client';
import dynamic from 'next/dynamic';
const Reader = dynamic(() => import('./reader'), {
  ssr: false,
  loading: () => <div className="skeleton" style={{ height: '70dvh' }} />,
});
export function PDFWorkspace({ id }: { id: string }) {
  return <Reader id={id} />;
}
