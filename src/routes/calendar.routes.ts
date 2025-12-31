import { RRule } from "rrule";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";

export const calendarRoutes = async (app: FastifyInstance) => {
    app.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
        const query = request.query as { start?: string; end?: string };
        const { start, end } = query;

        const whereClause: Record<string, unknown> = {};


        const queryStart = start ? new Date(start) : new Date();
        const queryEnd = end ? new Date(end) : new Date(new Date().setFullYear(new Date().getFullYear() + 1));

        if (start && end) {
            whereClause.OR = [

                {
                    start: { gte: queryStart, lte: queryEnd },
                    rrule: null,
                },
                {
                    end: { gte: queryStart, lte: queryEnd },
                    rrule: null,
                },
                {
                    AND: [{ start: { lte: queryStart } }, { end: { gte: queryEnd } }, { rrule: null }],
                },



                {
                    rrule: { not: null },
                    start: { lte: queryEnd },
                    OR: [
                        { repeat_end_date: { gte: queryStart } },
                        { repeat_end_date: null }
                    ]
                },

                {
                    start: null,
                },
            ];
        }

        const [events, categories, subcategories, platforms, users] = await Promise.all([
            prisma.events.findMany({
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
            }),
            prisma.event_categories.findMany({ orderBy: { name: "asc" } }),
            prisma.event_subcategories.findMany({ orderBy: { name: "asc" } }),
            prisma.event_platforms.findMany({ orderBy: { name: "asc" } }),
            prisma.users.findMany({
                where: { is_active: true },
                orderBy: { name: "asc" },
                select: { id: true, name: true, email: true, is_root_admin: true, custom_role_id: true },
            }),
        ]);


        const expandedEvents: typeof events = [];

        for (const event of events) {
            if (event.rrule && event.start) {
                try {

                    const dtstart = event.start;

                    const options = RRule.parseString(event.rrule);
                    options.dtstart = dtstart;

                    const rule = new RRule(options);



                    const dates = rule.between(queryStart, queryEnd, true);

                    const duration = event.end ? (event.end.getTime() - event.start.getTime()) : 0;

                    for (const date of dates) {

                        expandedEvents.push({
                            ...event,
                            start: date,
                            end: new Date(date.getTime() + duration),
                            recurrence_id: date, // Mark this instance
                        });
                    }
                } catch (err) {
                    console.error(`Échec de l'extension de la récurrence pour l'événement ${event.id}:`, err);


                    expandedEvents.push(event);
                }
            } else {

                expandedEvents.push(event);
            }
        }

        return reply.send({
            events: expandedEvents.map((e) => ({
                id: e.id,
                title: e.title,
                description: e.description,
                location: e.location,
                start: e.start,
                end: e.end,
                all_day: e.all_day,
                no_date: e.start === null,
                category: e.event_categories?.name,
                categoryId: e.category_id,
                categoryColor: e.event_categories?.color,
                subcategory: e.event_subcategories?.name,
                subcategory_id: e.subcategory_id,
                platform: e.event_platforms?.name,
                platform_id: e.platform_id,
                platformColor: e.event_platforms?.color,
                responsible: e.users?.name,
                responsible_id: e.responsible_id,
                repeat_type: e.repeat_type,
                repeat_end_date: e.repeat_end_date,
                rrule: e.rrule,
                recurrence_id: e.recurrence_id,
                exdate: e.exdate,
                alert_minutes: e.alert_minutes,
                email_alert_working_days: e.email_alert_working_days,
                status: e.status,
                tags: e.event_tags.map((t) => t.tag),
                attachments: e.event_attachments.map((a) => ({
                    id: a.id,
                    fileName: a.file_name,
                    fileSize: a.file_size,
                    mimeType: a.mime_type,
                    createdAt: a.created_at,
                })),
                created_at: e.created_at,
                updated_at: e.updated_at,
            })),
            categories: categories.map((c) => ({
                id: c.id,
                name: c.name,
                color: c.color,
                created_at: c.created_at,
                updated_at: c.updated_at,
            })),
            subcategories: subcategories.map((s) => ({
                id: s.id,
                name: s.name,
                category_id: s.category_id,
                created_at: s.created_at,
                updated_at: s.updated_at,
            })),
            platforms: platforms.map((p) => ({
                id: p.id,
                name: p.name,
                color: p.color,
                created_at: p.created_at,
                updated_at: p.updated_at,
            })),
            users: users.map((u) => ({
                id: u.id,
                name: u.name,
                email: u.email,
                isRootAdmin: u.is_root_admin,
                customRoleId: u.custom_role_id,
            })),
        });
    });
};
