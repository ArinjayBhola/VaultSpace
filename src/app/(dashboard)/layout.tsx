import { pageOwner } from '@/lib/auth';
import { Shell } from '@/components/layout/shell';
import { UploadProvider } from '@/components/uploads/upload-provider';
export const dynamic = 'force-dynamic';
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await pageOwner();
  return (
    <UploadProvider>
      <Shell user={{ name: user.name, email: user.email }}>{children}</Shell>
    </UploadProvider>
  );
}
