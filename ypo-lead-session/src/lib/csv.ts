import type { EventData } from "./summaries";
import { categoryLabel } from "./types";

function cell(v: unknown): string {
  const s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export type CsvType = "participants" | "needs" | "leads" | "notes";

export function buildCsv(type: CsvType, data: EventData): string {
  const name = new Map(data.participants.map((p) => [p.id, p.name]));
  const needOwner = new Map(data.needs.map((n) => [n.id, name.get(n.participant_id) ?? ""]));
  switch (type) {
    case "participants":
      return toCsv(
        ["name", "email", "chapter", "role", "presentation_order", "registered_at"],
        data.participants.map((p) => [p.name, p.email, p.chapter, p.role, p.presentation_order, p.created_at]),
      );
    case "needs":
      return toCsv(
        ["name", "category", "title", "description", "updated_at"],
        data.needs.map((n) => [name.get(n.participant_id), categoryLabel(n.category), n.title, n.description, n.updated_at]),
      );
    case "leads":
      return toCsv(
        ["need_owner", "lead_from", "strength", "source", "giver_note", "outreach_subject", "outreach_body"],
        data.leads.map((l) => [needOwner.get(l.need_id), name.get(l.giver_participant_id), l.strength ?? "", l.source, l.giver_note, l.outreach_subject, l.outreach_body]),
      );
    case "notes":
      // Facilitator export: shared notes only. Private notes stay private.
      return toCsv(
        ["on_need_of", "author", "body", "updated_at"],
        data.notes.filter((n) => n.visibility === "shared").map((n) => [needOwner.get(n.need_id), name.get(n.author_participant_id), n.body, n.updated_at]),
      );
  }
}
