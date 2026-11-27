import { Resend } from "resend";
import { sql } from "../db";
import { env } from "../env";

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  kind: "personal" | "digest" | "test" | "deck";
  attachments?: { filename: string; content: Buffer }[];
  eventId?: string | null;
  participantId?: string | null;
}

let resend: Resend | null = null;

/** Sends one email. Without RESEND_API_KEY (or with EMAIL_MOCK=1) it is only logged. Every send is recorded in email_log. */
export async function sendEmail(msg: OutgoingEmail): Promise<{ id: string | null; mocked: boolean }> {
  let id: string | null = null;
  const mocked = env.emailMock;
  if (!mocked) {
    resend ??= new Resend(env.resendKey);
    const { data, error } = await resend.emails.send({
      from: env.emailFrom,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      attachments: msg.attachments?.map((a) => ({ filename: a.filename, content: a.content })),
    });
    if (error) throw new Error(`Email to ${msg.to} failed: ${error.message}`);
    id = data?.id ?? null;
  } else {
    console.log(`[email:mock] ${msg.kind} → ${msg.to}: ${msg.subject}`);
  }
  await sql`
    insert into email_log (event_id, participant_id, kind, to_email, subject, html, text_body, provider_id, mocked, attachment_names)
    values (${msg.eventId ?? null}, ${msg.participantId ?? null}, ${msg.kind}, ${msg.to}, ${msg.subject}, ${msg.html}, ${msg.text}, ${id}, ${mocked},
      ${msg.attachments?.map((a) => a.filename).join(", ") ?? null})`;
  return { id, mocked };
}
