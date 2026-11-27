// AI features. Without ANTHROPIC_API_KEY (or with AI_MOCK=1) every function returns simple built-in text,
// so the app works end to end in development and tests.
import { z } from "zod";
import { env } from "../env";
import type { Category } from "../types";
import { generateJson } from "./client";
import { categoryPrompt, digestPrompt, outreachPrompt, summaryPrompt } from "./prompts";

export const outreachSchema = z.object({ subject: z.string(), body: z.string() });
export type OutreachDraft = z.infer<typeof outreachSchema>;

export const summaryAiSchema = z.object({
  need_recap: z.string(),
  lead_next_steps: z.array(z.object({ giver_name: z.string(), suggested_next_step: z.string() })),
  offered_follow_ups: z.array(z.object({ name: z.string(), reminder: z.string() })),
  top_3_actions: z.array(z.string()),
});
export type SummaryAi = z.infer<typeof summaryAiSchema>;

const categoryOut = z.object({ category: z.enum(["professional_services", "fundraising", "other"]) });
const digestOut = z.object({ overview: z.string() });

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

export async function draftOutreachEmail(input: Parameters<typeof outreachPrompt>[0]): Promise<OutreachDraft> {
  if (env.aiMock) {
    return {
      subject: `Following up from the YPL Lead Session: ${input.needTitle}`,
      body: `Hi ${firstName(input.leadName)},\n\nThank you for raising your hand at the YPL Week 2 Lead Session. As I mentioned, I'm looking for help with: ${input.needTitle}.${input.needDescription ? ` ${input.needDescription}` : ""}\n\n${input.leadNote ? `You mentioned ${input.leadNote}. ` : ""}Would you have 20 minutes for a quick call in the next week or two, or be open to making an email introduction?\n\nThanks again,\n${firstName(input.senderName)}`,
    };
  }
  return generateJson(outreachSchema, outreachPrompt(input), 2000);
}

export async function generateSummaryText(input: Parameters<typeof summaryPrompt>[0]): Promise<SummaryAi> {
  if (env.aiMock) {
    return {
      need_recap: `${input.name} is looking for help with: ${input.needTitle}.${input.needDescription ? ` ${input.needDescription}` : ""}`,
      lead_next_steps: input.leads.map((l) => ({
        giver_name: l.giverName,
        suggested_next_step: `Email ${firstName(l.giverName)} this week to set up a 20-minute call.`,
      })),
      offered_follow_ups: input.offered.map((o) => ({
        name: o.toName,
        reminder: `Send ${firstName(o.toName)} the introduction or contact you mentioned.`,
      })),
      top_3_actions: input.leads.length
        ? ["Send your outreach emails within 48 hours.", "Book calls with your strongest leads first.", "Thank everyone who raised a hand, even the weaker leads."]
        : ["Ask two members one-on-one who else might help.", "Sharpen your need into one specific ask.", "Bring it back to your chapter's next meeting."],
    };
  }
  const out = await generateJson(summaryAiSchema, summaryPrompt(input), 6000);
  return out;
}

export async function suggestCategory(text: string): Promise<Category> {
  if (env.aiMock || !text.trim()) {
    const t = text.toLowerCase();
    if (/(rais|investor|capital|fund|lender|loan|donor|equity|debt|acqui|buyer)/.test(t)) return "fundraising";
    if (/(lawyer|attorney|legal|account|cpa|tax|bank|consult|recruit|hire|vendor|advisor|insurance)/.test(t)) return "professional_services";
    return "other";
  }
  const out = await generateJson(categoryOut, categoryPrompt(text), 500);
  return out.category;
}

export async function generateDigestOverview(input: Parameters<typeof digestPrompt>[0]): Promise<string> {
  if (env.aiMock) {
    return `${input.people} members shared their needs and the group offered ${input.totalLeads} leads. Here is everyone's need, so you can keep helping each other.`;
  }
  const out = await generateJson(digestOut, digestPrompt(input), 1000);
  return out.overview;
}
