import { describe, expect, it } from "vitest";
import { canEditNeed, canManageLeadsOn, canOfferOn, canRegister, canSeeDrafts, canWithdrawOffer, noteVisibleTo } from "@/lib/access";

const open = { summaries_started_at: null, status: "live" as const };
const sent = { summaries_started_at: new Date(), status: "closed" as const };
const need = { participant_id: "owner" };
const owner = { participantId: "owner", isAdmin: false };
const other = { participantId: "other", isAdmin: false };
const admin = { participantId: null, isAdmin: true };

describe("lead rules", () => {
  it("only the owner or a facilitator can rate leads on a need", () => {
    expect(canManageLeadsOn(owner, need, open)).toBe(true);
    expect(canManageLeadsOn(other, need, open)).toBe(false);
    expect(canManageLeadsOn(admin, need, open)).toBe(true);
  });
  it("leads freeze for participants once summaries start", () => {
    expect(canManageLeadsOn(owner, need, sent)).toBe(false);
    expect(canManageLeadsOn(admin, need, sent)).toBe(true);
    expect(canOfferOn(other, need, sent)).toBe(false);
  });
  it("anyone else can offer a lead, but never on their own need", () => {
    expect(canOfferOn(other, need, open)).toBe(true);
    expect(canOfferOn(owner, need, open)).toBe(false);
    expect(canOfferOn({ participantId: null, isAdmin: false }, need, open)).toBe(false);
  });
  it("a giver can withdraw only until the owner rates the lead", () => {
    expect(canWithdrawOffer(other, { giver_participant_id: "other", strength: null }, need, open)).toBe(true);
    expect(canWithdrawOffer(other, { giver_participant_id: "other", strength: 4 }, need, open)).toBe(false);
    expect(canWithdrawOffer(owner, { giver_participant_id: "other", strength: 4 }, need, open)).toBe(true);
    expect(canWithdrawOffer({ participantId: "third", isAdmin: false }, { giver_participant_id: "other", strength: null }, need, open)).toBe(false);
  });
});

describe("other rules", () => {
  it("needs are editable by their owner until the session closes", () => {
    expect(canEditNeed(owner, need, { status: "live" })).toBe(true);
    expect(canEditNeed(owner, need, { status: "closed" })).toBe(false);
    expect(canEditNeed(other, need, { status: "live" })).toBe(false);
    expect(canEditNeed(admin, need, { status: "closed" })).toBe(true);
  });
  it("registration only while open", () => {
    expect(canRegister({ status: "registration_open" })).toBe(true);
    expect(canRegister({ status: "registration_locked" })).toBe(false);
  });
  it("private notes are visible only to their author", () => {
    expect(noteVisibleTo({ visibility: "private", author_participant_id: "a" }, "a")).toBe(true);
    expect(noteVisibleTo({ visibility: "private", author_participant_id: "a" }, "b")).toBe(false);
    expect(noteVisibleTo({ visibility: "shared", author_participant_id: "a" }, "b")).toBe(true);
  });
  it("only the owner sees outreach drafts", () => {
    expect(canSeeDrafts(owner, need)).toBe(true);
    expect(canSeeDrafts(other, need)).toBe(false);
  });
});
