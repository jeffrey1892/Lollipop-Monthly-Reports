import { describe, expect, it } from "vitest";
import { BODY_MAX, TITLE_MAX, walkthroughSteps } from "@/lib/walkthrough";

describe("How it works walkthrough", () => {
  const steps = walkthroughSteps({ sendDelayMinutes: 30, signInUntil: "2027-01-30" });

  it("has one page per feature", () => {
    expect(steps.map((s) => s.title)).toEqual([
      "Share your need",
      "Check your leads",
      "Offer a lead",
      "Browse the Index",
      "Take notes",
      "Draft follow-ups",
      "Get your summary",
    ]);
  });

  it(`keeps titles to ${TITLE_MAX} characters and descriptions to ${BODY_MAX}`, () => {
    for (const s of steps) {
      expect(s.title.length, s.title).toBeLessThanOrEqual(TITLE_MAX);
      expect(s.body.length, s.body).toBeLessThanOrEqual(BODY_MAX);
    }
    // Still within limits with the longest settings an admin can choose.
    for (const s of walkthroughSteps({ sendDelayMinutes: 1440, signInUntil: "2027-09-30" })) {
      expect(s.body.length, s.body).toBeLessThanOrEqual(BODY_MAX);
    }
  });

  it("states the real send delay and sign-in date", () => {
    expect(steps[6].body).toBe("30 minutes after the session closes, we email your leads and drafts. You stay signed in through Jan 30.");
  });
});
