import { describe, expect, it } from "vitest";
import { sessionExpiry } from "@/lib/session";

describe("how long people stay signed in", () => {
  const endOfJan30 = new Date("2027-01-31T05:00:00Z"); // midnight after Jan 30, Eastern
  it("lasts through the event's date", () => {
    expect(sessionExpiry(endOfJan30, new Date("2027-01-10T15:00:00Z"))).toEqual(endOfJan30);
  });
  it("never less than a day, even signing in at the last minute or after the date", () => {
    const late = new Date("2027-01-30T23:00:00Z");
    expect(sessionExpiry(endOfJan30, late)).toEqual(new Date(late.getTime() + 86_400_000));
  });
  it("falls back to 30 days when no date is set", () => {
    const now = new Date("2027-01-10T15:00:00Z");
    expect(sessionExpiry(null, now)).toEqual(new Date(now.getTime() + 30 * 86_400_000));
  });
});
