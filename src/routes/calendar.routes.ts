import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";

export const calendarRoutes = async (app: FastifyInstance) => {
    app.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
        const query = request.query as { start?: string; end?: string };
        const { start, end } = query;

        const whereClause: Record<string, unknown> = {};

        if (start && end) {
            whereClause.OR = [
                {
                    start: { gte: new Date(start), lte: new Date(end) },
                },
                {
                    end: { gte: new Date(start), lte: new Date(end) },
                },
                {
                    AND: [{ start: { lte: new Date(start) } }, { end: { gte: new Date(end) } }],
                },
                {
                    start: null,
                },
            ];
        }

        const events = await prisma.events.findMany({
            where: whereClause,
            include: {
                event_categories: { select: { id: true, name: true, color: true } },
                event_subcategories: { select: { id: true, name: true } },
                event_platforms: { select: { id: true, name: true, color: true } },
                users: { select: { id: true, name: true } },
                event_tags: { select: { tag: true } },
                event_attachments: {
                    select: { id: true, file_name: true, file_size: true, mime_type: true, created_at: true },
                },
            },
            orderBy: { start: "asc" },
        });

        return reply.send(
            events.map((e) => ({
                id: e.id,
                title: e.title,
                description: e.description,
                location: e.location,
                start: e.start,
                end: e.end,
                allDay: e.all_day,
                category: e.event_categories?.name,
                categoryId: e.category_id,
                categoryColor: e.event_categories?.color,
                subcategory: e.event_subcategories?.name,
                subcategoryId: e.subcategory_id,
                platform: e.event_platforms?.name,
                platformId: e.platform_id,
                platformColor: e.event_platforms?.color,
                responsible: e.users?.name,
                responsibleId: e.responsible_id,
                repeatType: e.repeat_type,
                repeatEndDate: e.repeat_end_date,
                rrule: e.rrule,
                recurrenceId: e.recurrence_id,
                exdate: e.exdate,
                alertMinutes: e.alert_minutes,
                emailAlertWorkingDays: e.email_alert_working_days,
                status: e.status,
                hasNoDate: e.start === null,
                tags: e.event_tags.map((t) => t.tag),
                attachments: e.event_attachments.map((a) => ({
                    id: a.id,
                    fileName: a.file_name,
                    fileSize: a.file_size,
                    mimeType: a.mime_type,
                    createdAt: a.created_at,
                })),
                createdAt: e.created_at,
                updatedAt: e.updated_at,
            })),
        );
    });
};
