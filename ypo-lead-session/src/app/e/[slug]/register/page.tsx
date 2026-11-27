import { getViewer } from "@/lib/auth";
import { getEventBySlug, getNeedByParticipant } from "@/lib/repo";
import type { Category } from "@/lib/types";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ email?: string }> }) {
  const { slug } = await params;
  const { email } = await searchParams;
  const event = (await getEventBySlug(slug))!;
  const viewer = await getViewer(slug);
  const need = viewer?.participant ? await getNeedByParticipant(viewer.participant.id) : null;
  const initial = viewer?.participant
    ? {
        name: viewer.participant.name,
        email: viewer.participant.email ?? "",
        chapter: viewer.participant.chapter,
        category: (need?.category ?? "") as Category | "",
        title: need?.title ?? "",
        description: need?.description ?? "",
      }
    : { name: "", email: email ?? "", chapter: "", category: "" as Category | "", title: "", description: "" };

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <RegisterForm slug={slug} initial={initial} existing={!!viewer?.participant} status={event.status} />
    </main>
  );
}
