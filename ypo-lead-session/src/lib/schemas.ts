import { z } from "zod";

export const categorySchema = z.enum(["professional_services", "fundraising", "other"]);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: "Enter a valid email address" }));

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(120),
  email: emailSchema,
  chapter: z.string().trim().min(1, "Enter your chapter").max(120),
  category: categorySchema,
  title: z.string().trim().min(1, "Give your need a short headline").max(140),
  description: z.string().trim().max(2000).default(""),
});

export const loginSchema = z.object({ email: emailSchema });
export const pinSchema = z.object({ pin: z.string().min(1).max(100) });

export const needUpdateSchema = z.object({
  participantId: z.uuid().optional(), // facilitators may edit someone else's need
  category: categorySchema,
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().max(2000).default(""),
});

export const strengthSchema = z.number().int().min(1).max(5);

export const leadSchema = z.object({
  needId: z.uuid(),
  giverId: z.uuid(),
  strength: strengthSchema.nullable(), // null = checked but not yet rated
  remove: z.boolean().optional(),
});

export const offerSchema = z.object({
  needId: z.uuid(),
  checked: z.boolean(),
  note: z.string().trim().max(280).optional(),
});

export const noteSchema = z.object({
  needId: z.uuid(),
  body: z.string().max(5000),
  visibility: z.enum(["private", "shared"]),
});

export const guestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.union([emailSchema, z.literal("")]).optional(),
  chapter: z.string().trim().max(120).optional(),
  needId: z.uuid().optional(), // also record them as a lead on this need
  strength: strengthSchema.nullable().optional(),
});

export const presenterSchema = z.object({ participantId: z.uuid().nullable() });

export const draftSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("generate"), leadId: z.uuid() }),
  z.object({
    action: z.literal("save"),
    leadId: z.uuid(),
    subject: z.string().max(300),
    body: z.string().max(5000),
  }),
]);

export const eventUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  location: z.string().trim().max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.union([z.string().regex(/^\d{2}:\d{2}$/), z.literal("")]),
  timezone: z.string().min(1).max(64),
  sendDelayMinutes: z.number().int().min(0).max(24 * 60),
  signInUntil: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).default(""),
  // Fixed day and time to send summaries; both blank = send sendDelayMinutes after closing.
  sendDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).default(""),
  sendTime: z.union([z.string().regex(/^\d{2}:\d{2}$/), z.literal("")]).default(""),
});

export const eventCreateSchema = eventUpdateSchema.extend({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{3,60}$/, "Use 3–60 lowercase letters, numbers and dashes"),
});

export const statusActionSchema = z.object({
  action: z.enum(["open_registration", "lock_registration", "go_live", "close"]),
});

export const adminParticipantSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.union([emailSchema, z.literal("")]).optional(),
  chapter: z.string().trim().max(120).default(""),
  category: categorySchema.optional(),
  title: z.string().trim().max(140).optional(),
  description: z.string().trim().max(2000).optional(),
});

export const orderSchema = z.object({ ids: z.array(z.uuid()).min(1) });

export function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Invalid input";
}
