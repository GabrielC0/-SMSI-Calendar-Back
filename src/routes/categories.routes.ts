import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";

const categorySchema = z.object({
    name: z.string().min(1, "Le nom est requis"),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Couleur invalide"),
});

export const categoriesRoutes = async (app: FastifyInstance) => {
    app.get("/", async (_request: FastifyRequest, reply: FastifyReply) => {
        const categories = await prisma.event_categories.findMany({
            include: {
                event_subcategories: true,
                _count: { select: { events: true } },
            },
            orderBy: { name: "asc" },
        });

        return reply.send(
            categories.map((c) => ({
                id: c.id,
                name: c.name,
                color: c.color,
                createdAt: c.created_at,
                updatedAt: c.updated_at,
                subcategories: c.event_subcategories.map((s) => ({
                    id: s.id,
                    name: s.name,
                    categoryId: s.category_id,
                })),
                eventCount: c._count.events,
            })),
        );
    });

    app.get("/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const id = parseInt(request.params.id, 10);

        if (isNaN(id)) {
            return reply.status(400).send({ error: "ID invalide" });
        }

        const category = await prisma.event_categories.findUnique({
            where: { id },
            include: {
                event_subcategories: true,
                _count: { select: { events: true } },
            },
        });

        if (!category) {
            return reply.status(404).send({ error: "Catégorie non trouvée" });
        }

        return reply.send({
            id: category.id,
            name: category.name,
            color: category.color,
            createdAt: category.created_at,
            updatedAt: category.updated_at,
            subcategories: category.event_subcategories.map((s) => ({
                id: s.id,
                name: s.name,
                categoryId: s.category_id,
            })),
            eventCount: category._count.events,
        });
    });

    app.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
        const result = categorySchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({
                error: result.error.issues[0]?.message ?? "Données invalides",
            });
        }

        const { name, color } = result.data;

        const existing = await prisma.event_categories.findFirst({
            where: { name: name.trim() },
        });

        if (existing) {
            return reply.status(409).send({ error: "Une catégorie avec ce nom existe déjà" });
        }

        const category = await prisma.event_categories.create({
            data: {
                name: name.trim(),
                color,
            },
        });

        return reply.status(201).send({
            id: category.id,
            name: category.name,
            color: category.color,
            createdAt: category.created_at,
            updatedAt: category.updated_at,
        });
    });

    app.put("/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const id = parseInt(request.params.id, 10);

        if (isNaN(id)) {
            return reply.status(400).send({ error: "ID invalide" });
        }

        const result = categorySchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({
                error: result.error.issues[0]?.message ?? "Données invalides",
            });
        }

        const { name, color } = result.data;

        const existing = await prisma.event_categories.findUnique({ where: { id } });

        if (!existing) {
            return reply.status(404).send({ error: "Catégorie non trouvée" });
        }

        const duplicate = await prisma.event_categories.findFirst({
            where: { name: name.trim(), id: { not: id } },
        });

        if (duplicate) {
            return reply.status(409).send({ error: "Une catégorie avec ce nom existe déjà" });
        }

        const category = await prisma.event_categories.update({
            where: { id },
            data: { name: name.trim(), color },
        });

        return reply.send({
            id: category.id,
            name: category.name,
            color: category.color,
            createdAt: category.created_at,
            updatedAt: category.updated_at,
        });
    });

    app.delete("/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const id = parseInt(request.params.id, 10);

        if (isNaN(id)) {
            return reply.status(400).send({ error: "ID invalide" });
        }

        const existing = await prisma.event_categories.findUnique({ where: { id } });

        if (!existing) {
            return reply.status(404).send({ error: "Catégorie non trouvée" });
        }

        await prisma.event_categories.delete({ where: { id } });

        return reply.send({ message: "Catégorie supprimée" });
    });
};
