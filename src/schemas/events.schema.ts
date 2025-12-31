import { z } from "zod";

export const eventCreateSchema = z.object({
    title: z.string().min(1, "Le titre est requis"),
    description: z.string().optional(),
    location: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    allDay: z.boolean().optional().default(true),
    category: z.string().optional(),
    subcategory: z.string().optional(),
    platform: z.string().optional(),
    responsible: z.union([z.number(), z.string()]).optional(),
    repeat: z.string().optional(),
    repeatEndDate: z.string().optional(),
    alert: z.string().optional(),
    emailAlert: z.string().optional(),
    status: z.string().optional(),
    isUnplanned: z.boolean().optional(),
    tags: z.string().optional(),
});

export const eventUpdateSchema = eventCreateSchema.partial();
