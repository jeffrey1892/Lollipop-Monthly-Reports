// One click, one deck: a slide per participant with their name, need and leads, from current data.
import PptxGenJS from "pptxgenjs";
import { sortLeads } from "./leads";
import { presenters } from "./repo";
import type { EventData } from "./summaries";
import { localParts } from "./format";
import type { EventRow } from "./types";

const CRIMSON = "A51C30";
const DARK = "2B2B2B";
const GRAY = "6B7280";

export interface SlideData {
  name: string;
  needTitle: string;
  needDescription: string;
  leads: { name: string; strength: number | null }[];
}

export function slideData(data: EventData): SlideData[] {
  const byId = new Map(data.participants.map((p) => [p.id, p]));
  return presenters(data.participants, data.needs).map((p) => {
    const need = data.needs.find((n) => n.participant_id === p.id)!;
    const leads = sortLeads(data.leads.filter((l) => l.need_id === need.id)).map((l) => ({
      name: byId.get(l.giver_participant_id)?.name ?? "A member",
      strength: l.strength,
    }));
    return { name: p.name, needTitle: need.title, needDescription: need.description, leads };
  });
}

export function deckFileName(event: EventRow): string {
  return `YPL-Week2-Lead-Session-${localParts(event.starts_at, event.timezone).date}.pptx`;
}

/** Shrink long text so it fits its box. */
function fitSize(text: string, base: number, min: number, charsAtBase: number): number {
  if (text.length <= charsAtBase) return base;
  return Math.max(min, Math.round(base * Math.sqrt(charsAtBase / text.length)));
}

export async function buildDeck(event: EventRow, data: EventData): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in, 16:9
  pptx.title = event.title;

  for (const s of slideData(data)) {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.18, fill: { color: CRIMSON }, line: { color: CRIMSON } });

    slide.addText(s.name, { x: 0.6, y: 0.45, w: 12.1, h: 1.0, fontFace: "Calibri", fontSize: 40, bold: true, color: CRIMSON });

    // Need (left)
    slide.addText("NEED", { x: 0.6, y: 1.6, w: 7.2, h: 0.4, fontFace: "Calibri", fontSize: 14, bold: true, color: GRAY, charSpacing: 2 });
    slide.addText(s.needTitle, {
      x: 0.6, y: 2.0, w: 7.2, h: 1.2, fontFace: "Calibri", bold: true, color: DARK, valign: "top",
      fontSize: fitSize(s.needTitle, 26, 16, 60), fit: "shrink",
    });
    if (s.needDescription) {
      slide.addText(s.needDescription, {
        x: 0.6, y: 3.25, w: 7.2, h: 3.7, fontFace: "Calibri", color: DARK, valign: "top",
        fontSize: fitSize(s.needDescription, 20, 11, 280), fit: "shrink",
      });
    }

    // Leads (right)
    slide.addShape(pptx.ShapeType.rect, { x: 8.2, y: 1.6, w: 4.55, h: 5.35, fill: { color: "F9F2F3" }, line: { color: "E8C9CE" } });
    slide.addText("LEADS", { x: 8.45, y: 1.7, w: 4.1, h: 0.4, fontFace: "Calibri", fontSize: 14, bold: true, color: CRIMSON, charSpacing: 2 });
    if (!s.leads.length) {
      slide.addText("No leads yet", { x: 8.45, y: 2.2, w: 4.1, h: 0.5, fontFace: "Calibri", fontSize: 18, italic: true, color: GRAY });
    } else {
      const size = s.leads.length > 10 ? 13 : s.leads.length > 7 ? 15 : 18;
      slide.addText(
        s.leads.map((l) => ({
          text: `${l.name}   ${l.strength === null ? "not rated" : `${l.strength}/5`}`,
          options: { bullet: true, breakLine: true },
        })),
        { x: 8.45, y: 2.2, w: 4.1, h: 4.6, fontFace: "Calibri", fontSize: size, color: DARK, valign: "top", fit: "shrink" },
      );
    }
  }

  const out = await pptx.write({ outputType: "nodebuffer" });
  return out as Buffer;
}
