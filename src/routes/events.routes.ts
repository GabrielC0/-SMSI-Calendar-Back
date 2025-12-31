import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { eventCreateSchema, eventUpdateSchema } from "../schemas/events.schema.js";
import {
    repeatTypeMap,
    alertMinutesMap,
    emailAlertDaysMap,
    parseTags,
    generateRRule,
    findOrCreateCategory,
    findOrCreateSubcategory,
    findOrCreatePlatform,
    resolveResponsibleId
} from "../utils/event.utils.js";

type JwtPayload = {
    userId: number;
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

        const categoryId = await findOrCreateCategory(data.category);
        const subcategoryId = await findOrCreateSubcategory(data.subcategory, categoryId);
        const platformId = await findOrCreatePlatform(data.platform);
        const responsibleId = await resolveResponsibleId(data.responsible);

        const repeatType = data.repeat ? (repeatTypeMap[data.repeat] ?? "none") : "none";
        const alertMinutes = data.alert ? alertMinutesMap[data.alert] ?? null : null;
        const emailAlertDays = data.emailAlert ? emailAlertDaysMap[data.emailAlert] ?? null : null;

        const startDateTime = isUnplanned || !data.startDate ? null : new Date(data.startDate);
        const endDateTime = isUnplanned || !data.endDate ? null : new Date(data.endDate);
        const repeatEndDateTime = data.repeatEndDate ? new Date(data.repeatEndDate) : null;

        const rrule = generateRRule(repeatType, repeatEndDateTime);

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
                rrule: rrule,
                alert_minutes: alertMinutes,
                email_alert_working_days: emailAlertDays,
                status: data.status?.trim() || (isUnplanned ? "Non planifié" : "Planifié"),
            },
        });

        if (data.tags) {
            const tags = parseTags(data.tags);
            if (tags.length > 0) {
                await prisma.event_tags.createMany({
                    data: tags.map((tag) => ({ event_id: event.id, tag })),
                    skipDuplicates: true,
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

        if (data.title !== undefined) updateData.title = data.title.trim();
        if (data.description !== undefined) updateData.description = data.description.trim() || null;
        if (data.location !== undefined) updateData.location = data.location.trim() || null;
        if (data.startDate !== undefined) updateData.start = data.startDate ? new Date(data.startDate) : null;
        if (data.endDate !== undefined) updateData.end = data.endDate ? new Date(data.endDate) : null;
        if (data.allDay !== undefined) updateData.all_day = data.allDay;
        if (data.status !== undefined) updateData.status = data.status.trim();

        if (data.repeat !== undefined) {
            updateData.repeat_type = repeatTypeMap[data.repeat] ?? "none";
        }

        if (data.repeatEndDate !== undefined) {
            updateData.repeat_end_date = data.repeatEndDate ? new Date(data.repeatEndDate) : null;
        }

        if (data.repeat !== undefined || data.repeatEndDate !== undefined) {
            const currentRepeatType = updateData.repeat_type !== undefined
                ? (updateData.repeat_type as string)
                : existing.repeat_type;

            const currentRepeatEndDate = updateData.repeat_end_date !== undefined
                ? (updateData.repeat_end_date as Date | null)
                : existing.repeat_end_date;

            updateData.rrule = generateRRule(currentRepeatType || "none", currentRepeatEndDate);
        }

        if (data.alert !== undefined) {
            updateData.alert_minutes = alertMinutesMap[data.alert] ?? null;
        }

        if (data.emailAlert !== undefined) {
            updateData.email_alert_working_days = emailAlertDaysMap[data.emailAlert] ?? null;
        }

        if (data.category !== undefined) {
            updateData.category_id = await findOrCreateCategory(data.category);
        }

        if (data.subcategory !== undefined) {
            const effectiveCategoryId = updateData.category_id !== undefined
                ? (updateData.category_id as number | null)
                : existing.category_id;

            updateData.subcategory_id = await findOrCreateSubcategory(data.subcategory, effectiveCategoryId);
        }

        if (data.platform !== undefined) {
            updateData.platform_id = await findOrCreatePlatform(data.platform);
        }

        if (data.responsible !== undefined) {
            updateData.responsible_id = await resolveResponsibleId(data.responsible);
        }

        const event = await prisma.events.update({
            where: { id },
            data: updateData,
        });

        if (data.tags !== undefined) {
            await prisma.event_tags.deleteMany({ where: { event_id: id } });

            const tags = parseTags(data.tags);
            if (tags.length > 0) {
                await prisma.event_tags.createMany({
                    data: tags.map((tag) => ({ event_id: id, tag })),
                    skipDuplicates: true,
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

        return reply.send({
            history: history.map((h) => ({
                id: h.id,
                eventId: h.event_id,
                action: h.action,
                performedBy: h.users,
                performedAt: h.performed_at,
                summary: h.summary,
                diff: h.diff,
                metadata: h.metadata,
            })),
        });
    });

    app.get("/:id/attachments", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const id = parseInt(request.params.id, 10);
        if (isNaN(id)) return reply.status(400).send({ error: "ID invalide" });

        const attachments = await prisma.event_attachments.findMany({
            where: { event_id: id },
            select: {
                id: true,
                event_id: true,
                file_name: true,
                file_size: true,
                mime_type: true,
                created_at: true,
            },
        });

        return reply.send({
            attachments: attachments.map((a) => ({
                id: a.id,
                eventId: a.event_id,
                fileName: a.file_name,
                fileSize: a.file_size,
                mimeType: a.mime_type,
                createdAt: a.created_at,
            })),
        });
    });

    app.post("/:id/attachments", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const id = parseInt(request.params.id, 10);
        if (isNaN(id)) return reply.status(400).send({ error: "ID invalide" });

        const event = await prisma.events.findUnique({ where: { id } });
        if (!event) return reply.status(404).send({ error: "Événement non trouvé" });

        const parts = request.parts();
        const uploadedFiles = [];

        for await (const part of parts) {
            if (part.type === "file") {
                const chunks: Buffer[] = [];
                for await (const chunk of part.file) {
                    chunks.push(chunk as Buffer);
                }
                const buffer = Buffer.concat(chunks);

                const attachment = await prisma.event_attachments.create({
                    data: {
                        event_id: id,
                        file_name: part.filename,
                        mime_type: part.mimetype ?? "application/octet-stream",
                        file_size: buffer.length,
                        file_data: buffer,
                    },
                    select: {
                        id: true,
                        event_id: true,
                        file_name: true,
                        file_size: true,
                        mime_type: true,
                        created_at: true,
                    },
                });
                uploadedFiles.push(attachment);
            }
        }

        return reply.send({
            message: "Fichiers uploadés",
            attachments: uploadedFiles.map((a) => ({
                id: a.id,
                eventId: a.event_id,
                fileName: a.file_name,
                fileSize: a.file_size,
                mimeType: a.mime_type,
                createdAt: a.created_at,
            })),
        });
    });

    app.get("/:id/attachments/:attachmentId/download", async (request: FastifyRequest<{ Params: { id: string; attachmentId: string } }>, reply: FastifyReply) => {
        const id = parseInt(request.params.id, 10);
        const attachmentId = parseInt(request.params.attachmentId, 10);
        if (isNaN(id) || isNaN(attachmentId)) return reply.status(400).send({ error: "ID invalide" });

        const attachment = await prisma.event_attachments.findFirst({
            where: { id: attachmentId, event_id: id },
        });

        if (!attachment || !attachment.file_data) {
            return reply.status(404).send({ error: "Fichier non trouvé" });
        }

        reply.header("Content-Disposition", `attachment; filename="${attachment.file_name}"`);
        reply.type(attachment.mime_type || "application/octet-stream");
        return reply.send(attachment.file_data);
    });

    app.delete("/:id/attachments/:attachmentId", async (request: FastifyRequest<{ Params: { id: string; attachmentId: string } }>, reply: FastifyReply) => {
        try {
            await request.jwtVerify();
        } catch {
            return reply.status(401).send({ error: "Non authentifié" });
        }

        const id = parseInt(request.params.id, 10);
        const attachmentId = parseInt(request.params.attachmentId, 10);
        if (isNaN(id) || isNaN(attachmentId)) return reply.status(400).send({ error: "ID invalide" });

        const attachment = await prisma.event_attachments.findFirst({
            where: { id: attachmentId, event_id: id },
        });

        if (!attachment) {
            return reply.status(404).send({ error: "Pièce jointe non trouvée" });
        }

        await prisma.event_attachments.delete({ where: { id: attachmentId } });

        return reply.send({ message: "Pièce jointe supprimée" });
    });
};
