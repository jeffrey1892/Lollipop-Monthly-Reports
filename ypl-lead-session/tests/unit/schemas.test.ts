import { describe, expect, it } from "vitest";
import { leadSchema, registerSchema } from "@/lib/schemas";

describe("registerSchema", () => {
  it("normalizes email and trims fields", () => {
    const r = registerSchema.parse({ name: "  Ana ", email: " Ana@Example.COM ", chapter: "Boston", category: "fundraising", title: " Raise ", description: "" });
    expect(r.email).toBe("ana@example.com");
    expect(r.name).toBe("Ana");
    expect(r.title).toBe("Raise");
  });
  it("rejects a bad email or missing headline", () => {
    expect(registerSchema.safeParse({ name: "A", email: "nope", chapter: "B", category: "other", title: "x" }).success).toBe(false);
    expect(registerSchema.safeParse({ name: "A", email: "a@b.co", chapter: "B", category: "other", title: " " }).success).toBe(false);
  });
});

describe("leadSchema", () => {
  const id = "3f2b8f2e-8a5e-4c1b-9f0e-0f6d2a1b7c3d";
  it("accepts 1–5 or null (checked but not rated)", () => {
    expect(leadSchema.safeParse({ needId: id, giverId: id, strength: 5 }).success).toBe(true);
    expect(leadSchema.safeParse({ needId: id, giverId: id, strength: null }).success).toBe(true);
    expect(leadSchema.safeParse({ needId: id, giverId: id, strength: 6 }).success).toBe(false);
    expect(leadSchema.safeParse({ needId: id, giverId: id, strength: 0 }).success).toBe(false);
  });
});
