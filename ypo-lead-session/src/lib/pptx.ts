// The session deck, built from current data:
//   1. an opening slide (logos, title, date, time, place)
//   2. the speaking order: everyone numbered, so people know when they're up
//   3. one numbered slide per person with their name, chapter and need (no leads: those are captured after the session)
import PptxGenJS from "pptxgenjs";
import { HBS_LOGO, YPO_LOGO } from "./logos";
import { presenters } from "./repo";
import type { EventData } from "./summaries";
import { eventWhenWhere, localParts } from "./format";
import type { EventRow } from "./types";

const CRIMSON = "A51C30";
const DARK = "2B2B2B";
const GRAY = "6B7280";
const FONT = "Calibri";
const W = 13.33; // LAYOUT_WIDE, inches
const H = 7.5;
const PANEL_W = W * 0.15 * 1.15; // "Up next" column: 15% of the slide, made 15% wider (about 17%)
const PANEL_X = W - PANEL_W;

export interface SlideData {
  number: number; // speaking order, from 1
  name: string;
  chapter: string;
  needTitle: string;
  needDescription: string;
}

export function slideData(data: Pick<EventData, "participants" | "needs">): SlideData[] {
  return presenters(data.participants, data.needs).map((p, i) => {
    const need = data.needs.find((n) => n.participant_id === p.id)!;
    return { number: i + 1, name: p.name, chapter: p.chapter, needTitle: need.title, needDescription: need.description };
  });
}

export function deckFileName(event: EventRow): string {
  return `YPO-Week2-Lead-Session-${localParts(event.starts_at, event.timezone).date}.pptx`;
}

/** Shrink long text so it fits its box. */
function fitSize(text: string, base: number, min: number, charsAtBase: number): number {
  if (text.length <= charsAtBase) return base;
  return Math.max(min, Math.round(base * Math.sqrt(charsAtBase / text.length)));
}

/** How the speaking-order list is split: up to 3 columns of up to 12 names per slide. */
export const ORDER_PER_COLUMN = 12;
export const ORDER_COLUMNS = 3;
export function orderPages<T>(items: T[]): T[][] {
  const perSlide = ORDER_PER_COLUMN * ORDER_COLUMNS;
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += perSlide) pages.push(items.slice(i, i + perSlide));
  return pages.length ? pages : [[]];
}

/** The next presenters after this one (5 by default), for the "Up next" panel. */
export function upNext<T extends { number: number }>(people: T[], number: number, count = 5): T[] {
  return people.slice(number, number + count); // number is 1-based, so this starts with the following person
}

function topBar(pptx: PptxGenJS, slide: PptxGenJS.Slide) {
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.18, fill: { color: CRIMSON }, line: { color: CRIMSON } });
}

function logos(slide: PptxGenJS.Slide, x: number, y: number, height: number) {
  const hbsW = (HBS_LOGO.w / HBS_LOGO.h) * height;
  const ypoW = (YPO_LOGO.w / YPO_LOGO.h) * height;
  slide.addImage({ data: HBS_LOGO.data, x, y, w: hbsW, h: height });
  slide.addImage({ data: YPO_LOGO.data, x: x + hbsW + height * 0.4, y, w: ypoW, h: height });
  return hbsW + height * 0.4 + ypoW;
}

export async function buildDeck(event: EventRow, data: EventData): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in, 16:9
  pptx.title = event.title;
  const people = slideData(data);
  const total = people.length;
  const whenWhere = eventWhenWhere({ startsAt: event.starts_at, endsAt: event.ends_at, timezone: event.timezone, location: event.location });

  // 1. Opening slide
  {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    topBar(pptx, slide);
    const logoH = 1.3;
    const logoW = (HBS_LOGO.w / HBS_LOGO.h) * logoH + logoH * 0.4 + (YPO_LOGO.w / YPO_LOGO.h) * logoH;
    logos(slide, (W - logoW) / 2, 0.9, logoH);
    slide.addText("Needs & Leads", { x: 0.6, y: 2.75, w: W - 1.2, h: 1.1, align: "center", fontFace: FONT, fontSize: 54, bold: true, color: CRIMSON });
    slide.addText(event.title, { x: 0.6, y: 3.85, w: W - 1.2, h: 0.6, align: "center", fontFace: FONT, fontSize: 24, color: DARK });
    slide.addText(whenWhere, { x: 0.6, y: 4.5, w: W - 1.2, h: 0.5, align: "center", fontFace: FONT, fontSize: 18, color: GRAY });
    slide.addText(
      [
        { text: "Come up when your number is next  ·  ", options: {} },
        { text: "Under a minute each  ·  ", options: {} },
        { text: "Can help? Raise your hand and hold up your name tag", options: {} },
      ],
      { x: 0.6, y: 5.6, w: W - 1.2, h: 0.5, align: "center", fontFace: FONT, fontSize: 16, color: DARK },
    );
    slide.addText(`${total} ${total === 1 ? "member" : "members"} sharing needs today`, {
      x: 0.6, y: 6.2, w: W - 1.2, h: 0.4, align: "center", fontFace: FONT, fontSize: 14, italic: true, color: GRAY,
    });
  }

  // 2. Speaking order (more than one slide only if there are more than 36 people)
  const pages = orderPages(people);
  pages.forEach((page, pi) => {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    topBar(pptx, slide);
    slide.addText(pages.length > 1 ? `Speaking order (${pi + 1} of ${pages.length})` : "Speaking order", {
      x: 0.6, y: 0.4, w: 9, h: 0.8, fontFace: FONT, fontSize: 34, bold: true, color: CRIMSON,
    });
    slide.addText("Be ready when the person before you is presenting.", { x: 0.6, y: 1.1, w: 9, h: 0.4, fontFace: FONT, fontSize: 16, color: GRAY });
    if (!page.length) {
      slide.addText("No one has signed up yet.", { x: 0.6, y: 2, w: 9, h: 0.5, fontFace: FONT, fontSize: 20, italic: true, color: GRAY });
      return;
    }
    // Spread names across columns (about 10 per column) so the list reads well from the back of the room.
    const cols = Math.min(ORDER_COLUMNS, Math.max(1, Math.ceil(page.length / 10)));
    const perCol = Math.ceil(page.length / cols);
    const colW = (W - 1.2) / cols;
    const size = perCol <= 8 ? 22 : perCol <= 10 ? 19 : 17;
    for (let c = 0; c < cols; c++) {
      const chunk = page.slice(c * perCol, (c + 1) * perCol);
      slide.addText(
        chunk.map((p) => ({
          text: `${p.number}.  ${p.name}${p.chapter ? `  ·  ${p.chapter}` : ""}`,
          options: { breakLine: true },
        })),
        { x: 0.6 + c * colW, y: 1.75, w: colW - 0.2, h: H - 2.3, valign: "top", fontFace: FONT, fontSize: size, color: DARK, paraSpaceAfter: 6, fit: "shrink" },
      );
    }
  });

  // 3. One numbered slide per person
  for (const s of people) {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    topBar(pptx, slide);

    // Speaking number badge + name
    slide.addShape(pptx.ShapeType.ellipse, { x: 0.6, y: 0.5, w: 0.95, h: 0.95, fill: { color: CRIMSON }, line: { color: CRIMSON } });
    slide.addText(String(s.number), { x: 0.6, y: 0.5, w: 0.95, h: 0.95, align: "center", valign: "middle", fontFace: FONT, fontSize: s.number > 99 ? 22 : 30, bold: true, color: "FFFFFF" });
    slide.addText(s.name, { x: 1.75, y: 0.45, w: PANEL_X - 2.15, h: 0.75, fontFace: FONT, fontSize: 38, bold: true, color: CRIMSON, fit: "shrink" });
    if (s.chapter) slide.addText(s.chapter, { x: 1.75, y: 1.12, w: PANEL_X - 2.15, h: 0.4, fontFace: FONT, fontSize: 16, color: GRAY });

    // Need on the left, large enough to read from the back of the room
    const needW = PANEL_X - 0.6 - 0.4;
    slide.addShape(pptx.ShapeType.line, { x: 0.6, y: 1.75, w: needW, h: 0, line: { color: "E5E7EB", width: 1 } });
    // Place the details right under the headline (about 5 characters per inch at 34 pt).
    const titleSize = fitSize(s.needTitle, 36, 22, 70);
    const charsPerLine = needW * 5 * (34 / titleSize);
    const titleLines = Math.min(3, Math.max(1, Math.ceil(s.needTitle.length / charsPerLine)));
    const titleH = titleLines * (titleSize / 72) * 1.25 + 0.15;
    slide.addText(s.needTitle, {
      x: 0.6, y: 2.0, w: needW, h: titleH, fontFace: FONT, bold: true, color: DARK, valign: "top",
      fontSize: titleSize, fit: "shrink",
    });
    if (s.needDescription) {
      const descY = 2.0 + titleH + 0.25;
      slide.addText(s.needDescription, {
        x: 0.6, y: descY, w: needW, h: 7.1 - descY, fontFace: FONT, color: DARK, valign: "top",
        fontSize: fitSize(s.needDescription, 26, 14, 300), fit: "shrink",
      });
    }

    // Right-hand column (about 17% of the slide): "3 of 12", then the next five presenters in large type
    const colW = W - PANEL_X;
    const inX = PANEL_X + 0.2;
    const inW = colW - 0.35;
    slide.addShape(pptx.ShapeType.rect, { x: PANEL_X, y: 0.18, w: colW, h: H - 0.18, fill: { color: "F9F2F3" }, line: { color: "F9F2F3" } });
    slide.addText(
      [
        { text: String(s.number), options: { fontSize: 30, bold: true, color: CRIMSON } },
        { text: ` of ${total}`, options: { fontSize: 18, bold: true, color: CRIMSON } },
      ],
      { x: inX, y: 0.4, w: inW, h: 0.7, fontFace: FONT, valign: "middle" },
    );
    slide.addShape(pptx.ShapeType.line, { x: inX, y: 1.2, w: inW, h: 0, line: { color: "E8C9CE", width: 1 } });
    slide.addText("UP NEXT", { x: inX, y: 1.3, w: inW, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: CRIMSON, charSpacing: 2 });
    const next = upNext(people, s.number);
    if (!next.length) {
      slide.addText("Last presenter. Thank you, everyone!", { x: inX, y: 1.8, w: inW, h: 1.4, fontFace: FONT, fontSize: 18, italic: true, color: GRAY, valign: "top" });
    } else {
      next.forEach((p, i) => {
        slide.addText(
          [
            { text: `${p.number}`, options: { fontSize: 24, bold: true, color: i === 0 ? CRIMSON : GRAY, breakLine: true } },
            { text: p.name, options: { fontSize: 20, bold: i === 0, color: DARK } },
          ],
          { x: inX, y: 1.8 + i * 1.1, w: inW, h: 1.05, fontFace: FONT, valign: "top", fit: "shrink", paraSpaceAfter: 0 },
        );
      });
    }
  }

  const out = await pptx.write({ outputType: "nodebuffer" });
  return out as Buffer;
}
