import { NeedDetail } from "./NeedDetail";

export default async function NeedDetailPage({ params }: { params: Promise<{ pid: string }> }) {
  const { pid } = await params;
  return <NeedDetail participantId={pid} />;
}
