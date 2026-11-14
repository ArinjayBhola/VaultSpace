import { PublicShare } from '@/components/public-share';
export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return <PublicShare token={(await params).token} />;
}
