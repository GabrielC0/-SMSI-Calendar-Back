import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";

type JwtPayload = {
    userId: number;
};

const eventCreateSchema = z.object({
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

const eventUpdateSchema = eventCreateSchema.partial();

const repeatTypeMap: Record<string, string> = {
    Jamais: "none",
    "Chaque semaine": "weekly",
    "Chaque mois": "monthly",
    "Chaque trimestre": "quarterly",
    "Chaque semestre": "semestrial",
    "Chaque année": "yearly",
};

const alertMinutesMap: Record<string, number | null> = {
    Aucune: null,
    "15 minutes avant": 15,
    "30 minutes avant": 30,
    "1 heure avant": 60,
    "2 heures avant": 120,
    "1 jour avant": 1440,
};

const emailAlertDaysMap: Record<string, number | null> = {
    Aucune: null,
    "1 jour ouvrable avant": 1,
    "2 jours ouvrables avant": 2,
    "3 jours ouvrables avant": 3,
    "5 jours ouvrables avant": 5,
    "1 semaine ouvrable avant": 5,
    "2 semaines ouvrables avant": 10,
};

const parseHashtags = (input: string): string[] => {
    const matches = input.match(/#[\wÀ-ÿ]+/g);
    return matches ? matches.map((tag) => tag.slice(1)) : [];
};

export const eventsRoutes = async (app: FastifyInstance) => {
    app.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
        const query = request.query as { status?: string; categoryId?: string; platformId?: string };

        const whereClause: Record<string, unknown> = {};

        if (query.status) {
            whereClause.status = query.status;
        }

        if (query.categoryId) {
            const categoryId = parseInt(query.categoryId, 10);
            if (!isNaN(categoryId)) {
                whereClause.category_id = categoryId;
            }
        }

        if (query.platformId) {
            const platformId = parseInt(query.platformId, 10);
            if (!isNaN(platformId)) {
                whereClause.platform_id = platformId;
            }
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

    app.get("/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const id = parseInt(request.params.id, 10);

        if (isNaN(id)) {
            return reply.status(400).send({ error: "ID invalide" });
        }

        const event = await prisma.events.findUnique({
            where: { id },
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
        });

        if (!event) {
            return reply.status(404).send({ error: "Événement non trouvé" });
        }

        return reply.send({
            id: event.id,
            title: event.title,
            description: event.description,
            location: event.location,
            start: event.start,
            end: event.end,
            allDay: event.all_day,
            category: event.event_categories?.name,
            categoryId: event.category_id,
            categoryColor: event.event_categories?.color,
            subcategory: event.event_subcategories?.name,
            subcategoryId: event.subcategory_id,
            platform: event.event_platforms?.name,
            platformId: event.platform_id,
            platformColor: event.event_platforms?.color,
            responsible: event.users?.name,
            responsibleId: event.responsible_id,
            repeatType: event.repeat_type,
            repeatEndDate: event.repeat_end_date,
            rrule: event.rrule,
            recurrenceId: event.recurrence_id,
            exdate: event.exdate,
            alertMinutes: event.alert_minutes,
            emailAlertWorkingDays: event.email_alert_working_days,
            status: event.status,
            hasNoDate: event.start === null,
            tags: event.event_tags.map((t) => t.tag),
            attachments: event.event_attachments.map((a) => ({
                id: a.id,
                fileName: a.file_name,
                fileSize: a.file_size,
                mimeType: a.mime_type,
                createdAt: a.created_at,
            })),
            createdAt: event.created_at,
            updatedAt: event.updated_at,
        });
    });

    app.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            await request.jwtVerify();
        } catch {
            return reply.status(401).send({ error: "Non authentifié" });
        }

        const payload = request.user as JwtPayload;

        const result = eventCreateSchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({
                error: result.error.issues[0]?.message ?? "Données invalides",
            });
        }

        const data = result.data;
        const isUnplanned = data.isUnplanned ?? false;

        let categoryId: number | null = null;
        if (data.category?.trim()) {
            const category = await prisma.event_categories.findFirst({
                where: { name: data.category.trim() },
            });
            if (category) {
                categoryId = category.id;
            } else {
                const newCategory = await prisma.event_categories.create({
                    data: { name: data.category.trim(), color: "#3B82F6" },
                });
                categoryId = newCategory.id;
            }
        }

        let subcategoryId: number | null = null;
        if (data.subcategory?.trim() && categoryId) {
            const subcategory = await prisma.event_subcategories.findFirst({
                where: { name: data.subcategory.trim(), category_id: categoryId },
            });
            if (subcategory) {
                subcategoryId = subcategory.id;
            }
        }

        let platformId: number | null = null;
        if (data.platform?.trim()) {
            const platform = await prisma.event_platforms.findFirst({
                where: { name: data.platform.trim() },
            });
            if (platform) {
                platformId = platform.id;
            } else {
                const newPlatform = await prisma.event_platforms.create({
                    data: { name: data.platform.trim(), color: "#3B82F6" },
                });
                platformId = newPlatform.id;
            }
        }

        let responsibleId: number | null = null;
        if (data.responsible) {
            const respId = typeof data.responsible === "string" ? parseInt(data.responsible, 10) : data.responsible;
            if (!isNaN(respId)) {
                const user = await prisma.users.findUnique({ where: { id: respId } });
                if (user) {
                    responsibleId = user.id;
                }
            }
        }

        const repeatType = data.repeat ? (repeatTypeMap[data.repeat] ?? "none") : "none";
        const alertMinutes = data.alert ? alertMinutesMap[data.alert] ?? null : null;
        const emailAlertDays = data.emailAlert ? emailAlertDaysMap[data.emailAlert] ?? null : null;

        const startDateTime = isUnplanned || !data.startDate ? null : new Date(data.startDate);
        const endDateTime = isUnplanned || !data.endDate ? null : new Date(data.endDate);
        const repeatEndDateTime = data.repeatEndDate ? new Date(data.repeatEndDate) : null;

        const event = await prisma.events.create({
            data: {
                title: data.title.trim(),
                description: data.description?.trim() || null,
                location: data.location?.trim() || null,
                start: startDateTime,
                end: endDateTime,
                all_day: data.allDay ?? true,
                category_id: categoryId,
                subcategory_id: subcategoryId,
                platform_id: platformId,
                responsible_id: responsibleId,
                repeat_type: repeatType as "none" | "weekly" | "monthly" | "quarterly" | "semestrial" | "yearly",
                repeat_end_date: repeatEndDateTime,
                alert_minutes: alertMinutes,
                email_alert_working_days: emailAlertDays,
                status: data.status?.trim() || (isUnplanned ? "Non planifié" : "Planifié"),
            },
        });

        if (data.tags) {
            const tags = parseHashtags(data.tags);
            if (tags.length > 0) {
                await prisma.event_tags.createMany({
                    data: tags.map((tag) => ({ event_id: event.id, tag })),
                });
            }
        }

        await prisma.event_history.create({
            data: {
                event_id: event.id,
                action: "created",
                performed_by: payload.userId,
                summary: `Événement "${event.title}" créé`,
            },
        });

        return reply.status(201).send({
            id: event.id,
            title: event.title,
            start: event.start,
            end: event.end,
            status: event.status,
            createdAt: event.created_at,
        });
    });

    app.put("/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        try {
            await request.jwtVerify();
        } catch {
            return reply.status(401).send({ error: "Non authentifié" });
        }

        const payload = request.user as JwtPayload;
        const id = parseInt(request.params.id, 10);

        if (isNaN(id)) {
            return reply.status(400).send({ error: "ID invalide" });
        }

        const existing = await prisma.events.findUnique({ where: { id } });

        if (!existing) {
            return reply.status(404).send({ error: "Événement non trouvé" });
        }

        const result = eventUpdateSchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({
                error: result.error.issues[0]?.message ?? "Données invalides",
            });
        }

        const data = result.data;
        const updateData: Record<string, unknown> = {};

        if (data.title !== undefined) {
            updateData.title = data.title.trim();
        }

        if (data.description !== undefined) {
            updateData.description = data.description.trim() || null;
        }

        if (data.location !== undefined) {
            updateData.location = data.location.trim() || null;
        }

        if (data.startDate !== undefined) {
            updateData.start = data.startDate ? new Date(data.startDate) : null;
        }

        if (data.endDate !== undefined) {
            updateData.end = data.endDate ? new Date(data.endDate) : null;
        }

        if (data.allDay !== undefined) {
            updateData.all_day = data.allDay;
        }

        if (data.status !== undefined) {
            updateData.status = data.status.trim();
        }

        if (data.repeat !== undefined) {
            updateData.repeat_type = repeatTypeMap[data.repeat] ?? "none";
        }

        if (data.repeatEndDate !== undefined) {
            updateData.repeat_end_date = data.repeatEndDate ? new Date(data.repeatEndDate) : null;
        }

        if (data.alert !== undefined) {
            updateData.alert_minutes = alertMinutesMap[data.alert] ?? null;
        }

        if (data.emailAlert !== undefined) {
            updateData.email_alert_working_days = emailAlertDaysMap[data.emailAlert] ?? null;
        }

        if (data.category !== undefined) {
            if (data.category.trim()) {
                const category = await prisma.event_categories.findFirst({
                    where: { name: data.category.trim() },
                });
                updateData.category_id = category?.id ?? null;
            } else {
                updateData.category_id = null;
            }
        }

        if (data.platform !== undefined) {
            if (data.platform.trim()) {
                const platform = await prisma.event_platforms.findFirst({
                    where: { name: data.platform.trim() },
                });
                updateData.platform_id = platform?.id ?? null;
            } else {
                updateData.platform_id = null;
            }
        }

        if (data.responsible !== undefined) {
            if (data.responsible) {
                const respId =
                    typeof data.responsible === "string" ? parseInt(data.responsible, 10) : data.responsible;
                if (!isNaN(respId)) {
                    const user = await prisma.users.findUnique({ where: { id: respId } });
                    updateData.responsible_id = user?.id ?? null;
                }
            } else {
                updateData.responsible_id = null;
            }
        }

        const event = await prisma.events.update({
            where: { id },
            data: updateData,
        });

        if (data.tags !== undefined) {
            await prisma.event_tags.deleteMany({ where: { event_id: id } });

            const tags = parseHashtags(data.tags);
            if (tags.length > 0) {
                await prisma.event_tags.createMany({
                    data: tags.map((tag) => ({ event_id: id, tag })),
                });
            }
        }

        await prisma.event_history.create({
            data: {
                event_id: event.id,
                action: "updated",
                performed_by: payload.userId,
                summary: `Événement "${event.title}" modifié`,
            },
        });

        return reply.send({
            id: event.id,
            title: event.title,
            start: event.start,
            end: event.end,
            status: event.status,
            updatedAt: event.updated_at,
        });
    });

    app.delete("/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        try {
            await request.jwtVerify();
        } catch {
            return reply.status(401).send({ error: "Non authentifié" });
        }

        const id = parseInt(request.params.id, 10);

        if (isNaN(id)) {
            return reply.status(400).send({ error: "ID invalide" });
        }

        const existing = await prisma.events.findUnique({ where: { id } });

        if (!existing) {
            return reply.status(404).send({ error: "Événement non trouvé" });
        }

        await prisma.events.delete({ where: { id } });

        return reply.send({ message: "Événement supprimé" });
    });

    app.get("/:id/history", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const id = parseInt(request.params.id, 10);

        if (isNaN(id)) {
            return reply.status(400).send({ error: "ID invalide" });
        }

        const history = await prisma.event_history.findMany({
            where: { event_id: id },
            include: { users: { select: { id: true, name: true } } },
            orderBy: { performed_at: "desc" },
        });

        return reply.send(
            history.map((h) => ({
                id: h.id,
                eventId: h.event_id,
                action: h.action,
                performedBy: h.users,
                performedAt: h.performed_at,
                summary: h.summary,
                diff: h.diff,
                metadata: h.metadata,
            })),
        );
    });
};
