import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";

const platformSchema = z.object({
    name: z.string().min(1, "Le nom est requis"),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Couleur invalide"),
});

export const platformsRoutes = async (app: FastifyInstance) => {
    app.get("/", async (_request: FastifyRequest, reply: FastifyReply) => {
        const platforms = await prisma.event_platforms.findMany({
            include: { _count: { select: { events: true } } },
            orderBy: { name: "asc" },
        });

        return reply.send(
            platforms.map((p) => ({
                id: p.id,
                name: p.name,
                color: p.color,
                eventCount: p._count.events,
                createdAt: p.created_at,
                updatedAt: p.updated_at,
            })),
        );
    });

    app.get("/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const id = parseInt(request.params.id, 10);

        if (isNaN(id)) {
            return reply.status(400).send({ error: "ID invalide" });
        }

        const platform = await prisma.event_platforms.findUnique({
            where: { id },
            include: { _count: { select: { events: true } } },
        });

        if (!platform) {
            return reply.status(404).send({ error: "Plateforme non trouvée" });
        }

        return reply.send({
            id: platform.id,
            name: platform.name,
            color: platform.color,
            eventCount: platform._count.events,
            createdAt: platform.created_at,
            updatedAt: platform.updated_at,
        });
    });

    app.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
        const result = platformSchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({
                error: result.error.issues[0]?.message ?? "Données invalides",
            });
        }

        const { name, color } = result.data;

        const existing = await prisma.event_platforms.findFirst({
            where: { name: name.trim().toUpperCase() },
        });

        if (existing) {
            return reply.status(409).send({ error: "Une plateforme avec ce nom existe déjà" });
        }

        const platform = await prisma.event_platforms.create({
            data: { name: name.trim().toUpperCase(), color },
        });

        return reply.status(201).send({
            id: platform.id,
            name: platform.name,
            color: platform.color,
            createdAt: platform.created_at,
            updatedAt: platform.updated_at,
        });
    });

    app.put("/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const id = parseInt(request.params.id, 10);

        if (isNaN(id)) {
            return reply.status(400).send({ error: "ID invalide" });
        }

        const result = platformSchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({
                error: result.error.issues[0]?.message ?? "Données invalides",
            });
        }

        const { name, color } = result.data;

        const existing = await prisma.event_platforms.findUnique({ where: { id } });

        if (!existing) {
            return reply.status(404).send({ error: "Plateforme non trouvée" });
        }

        const duplicate = await prisma.event_platforms.findFirst({
            where: { name: name.trim().toUpperCase(), id: { not: id } },
        });

        if (duplicate) {
            return reply.status(409).send({ error: "Une plateforme avec ce nom existe déjà" });
        }

        const platform = await prisma.event_platforms.update({
            where: { id },
            data: { name: name.trim().toUpperCase(), color },
        });

        return reply.send({
            id: platform.id,
            name: platform.name,
            color: platform.color,
            createdAt: platform.created_at,
            updatedAt: platform.updated_at,
        });
    });

    app.delete("/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const id = parseInt(request.params.id, 10);

        if (isNaN(id)) {
            return reply.status(400).send({ error: "ID invalide" });
        }

        const existing = await prisma.event_platforms.findUnique({ where: { id } });

        if (!existing) {
            return reply.status(404).send({ error: "Plateforme non trouvée" });
        }

        await prisma.event_platforms.delete({ where: { id } });

        return reply.send({ message: "Plateforme supprimée" });
    });
};
