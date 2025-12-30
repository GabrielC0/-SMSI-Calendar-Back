import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";

type JwtPayload = {
    userId: number;
};

const warningsSchema = z.object({
    redDays: z.number().int().min(0).optional(),
    orangeDays: z.number().int().min(0).optional(),
    colors: z
        .object({
            red: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
            orange: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
            green: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
        })
        .optional(),
});

const filtersSchema = z.object({
    statusFilter: z.array(z.string()).optional(),
    categoryIds: z.array(z.number()).optional(),
    platformIds: z.array(z.number()).optional(),
    responsibleIds: z.array(z.number()).optional(),
    tagFilter: z.array(z.string()).optional(),
});

const uiSchema = z.object({
    logoAnimationEnabled: z.boolean().optional(),
    theme: z.string().optional(),
});

export const settingsRoutes = async (app: FastifyInstance) => {
    app.get("/warnings", async (_request: FastifyRequest, reply: FastifyReply) => {
        const settings = await prisma.event_warning_settings.findFirst({
            where: { id: 1 },
        });

        if (!settings) {
            return reply.send({
                redDays: 0,
                orangeDays: 7,
                colors: {
                    red: "#ef4444",
                    orange: "#f59e0b",
                    green: "#22c55e",
                },
            });
        }

        return reply.send({
            redDays: settings.red_days,
            orangeDays: settings.orange_days,
            colors: {
                red: settings.red_color,
                orange: settings.orange_color,
                green: settings.green_color,
            },
        });
    });

    app.put("/warnings", async (request: FastifyRequest, reply: FastifyReply) => {
        const result = warningsSchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({
                error: result.error.issues[0]?.message ?? "Données invalides",
            });
        }

        const { redDays, orangeDays, colors } = result.data;

        const settings = await prisma.event_warning_settings.upsert({
            where: { id: 1 },
            update: {
                ...(redDays !== undefined ? { red_days: redDays } : {}),
                ...(orangeDays !== undefined ? { orange_days: orangeDays } : {}),
                ...(colors?.red !== undefined ? { red_color: colors.red } : {}),
                ...(colors?.orange !== undefined ? { orange_color: colors.orange } : {}),
                ...(colors?.green !== undefined ? { green_color: colors.green } : {}),
            },
            create: {
                id: 1,
                red_days: redDays ?? 0,
                orange_days: orangeDays ?? 7,
                red_color: colors?.red ?? "#ef4444",
                orange_color: colors?.orange ?? "#f59e0b",
                green_color: colors?.green ?? "#22c55e",
            },
        });

        return reply.send({
            redDays: settings.red_days,
            orangeDays: settings.orange_days,
            colors: {
                red: settings.red_color,
                orange: settings.orange_color,
                green: settings.green_color,
            },
        });
    });

    app.get("/filters", async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            await request.jwtVerify();
        } catch {
            return reply.status(401).send({ error: "Non authentifié" });
        }

        const payload = request.user as JwtPayload;

        const filters = await prisma.user_filters.findUnique({
            where: { user_id: payload.userId },
        });

        if (!filters) {
            return reply.send({
                statusFilter: [],
                categoryIds: [],
                platformIds: [],
                responsibleIds: [],
                tagFilter: [],
            });
        }

        return reply.send({
            statusFilter: filters.status_filter ?? [],
            categoryIds: filters.category_ids ?? [],
            platformIds: filters.platform_ids ?? [],
            responsibleIds: filters.responsible_ids ?? [],
            tagFilter: filters.tag_filter ?? [],
        });
    });

    app.put("/filters", async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            await request.jwtVerify();
        } catch {
            return reply.status(401).send({ error: "Non authentifié" });
        }

        const payload = request.user as JwtPayload;

        const result = filtersSchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({
                error: result.error.issues[0]?.message ?? "Données invalides",
            });
        }

        const { statusFilter, categoryIds, platformIds, responsibleIds, tagFilter } = result.data;

        const filters = await prisma.user_filters.upsert({
            where: { user_id: payload.userId },
            update: {
                ...(statusFilter !== undefined ? { status_filter: statusFilter } : {}),
                ...(categoryIds !== undefined ? { category_ids: categoryIds } : {}),
                ...(platformIds !== undefined ? { platform_ids: platformIds } : {}),
                ...(responsibleIds !== undefined ? { responsible_ids: responsibleIds } : {}),
                ...(tagFilter !== undefined ? { tag_filter: tagFilter } : {}),
            },
            create: {
                user_id: payload.userId,
                status_filter: statusFilter ?? [],
                category_ids: categoryIds ?? [],
                platform_ids: platformIds ?? [],
                responsible_ids: responsibleIds ?? [],
                tag_filter: tagFilter ?? [],
            },
        });

        return reply.send({
            statusFilter: filters.status_filter,
            categoryIds: filters.category_ids,
            platformIds: filters.platform_ids,
            responsibleIds: filters.responsible_ids,
            tagFilter: filters.tag_filter,
        });
    });

    app.get("/ui", async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            await request.jwtVerify();
        } catch {
            return reply.status(401).send({ error: "Non authentifié" });
        }

        const payload = request.user as JwtPayload;

        const settings = await prisma.user_settings.findUnique({
            where: { user_id: payload.userId },
        });

        if (!settings) {
            return reply.send({
                logoAnimationEnabled: true,
                theme: "glass",
            });
        }

        return reply.send({
            logoAnimationEnabled: settings.logo_animation_enabled,
            theme: settings.theme,
        });
    });

    app.put("/ui", async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            await request.jwtVerify();
        } catch {
            return reply.status(401).send({ error: "Non authentifié" });
        }

        const payload = request.user as JwtPayload;

        const result = uiSchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({
                error: result.error.issues[0]?.message ?? "Données invalides",
            });
        }

        const { logoAnimationEnabled, theme } = result.data;

        const settings = await prisma.user_settings.upsert({
            where: { user_id: payload.userId },
            update: {
                ...(logoAnimationEnabled !== undefined ? { logo_animation_enabled: logoAnimationEnabled } : {}),
                ...(theme !== undefined ? { theme } : {}),
            },
            create: {
                user_id: payload.userId,
                logo_animation_enabled: logoAnimationEnabled ?? true,
                theme: theme ?? "glass",
            },
        });

        return reply.send({
            logoAnimationEnabled: settings.logo_animation_enabled,
            theme: settings.theme,
        });
    });
};
