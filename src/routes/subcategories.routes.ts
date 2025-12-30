import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";

const subcategorySchema = z.object({
    name: z.string().min(1, "Le nom est requis"),
    categoryId: z.number().int().positive("categoryId doit être un entier positif"),
});

const subcategoryUpdateSchema = z.object({
    name: z.string().min(1, "Le nom est requis"),
});

export const subcategoriesRoutes = async (app: FastifyInstance) => {
    app.get("/", async (_request: FastifyRequest, reply: FastifyReply) => {
        const subcategories = await prisma.event_subcategories.findMany({
            include: {
                event_categories: { select: { id: true, name: true, color: true } },
                _count: { select: { events: true } },
            },
            orderBy: { name: "asc" },
        });

        return reply.send(
            subcategories.map((s) => ({
                id: s.id,
                name: s.name,
                categoryId: s.category_id,
                category: s.event_categories,
                eventCount: s._count.events,
                createdAt: s.created_at,
                updatedAt: s.updated_at,
            })),
        );
    });

    app.get("/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const id = parseInt(request.params.id, 10);

        if (isNaN(id)) {
            return reply.status(400).send({ error: "ID invalide" });
        }

        const subcategory = await prisma.event_subcategories.findUnique({
            where: { id },
            include: { event_categories: true },
        });

        if (!subcategory) {
            return reply.status(404).send({ error: "Sous-catégorie non trouvée" });
        }

        return reply.send({
            id: subcategory.id,
            name: subcategory.name,
            categoryId: subcategory.category_id,
            category: subcategory.event_categories,
            createdAt: subcategory.created_at,
            updatedAt: subcategory.updated_at,
        });
    });

    app.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
        const result = subcategorySchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({
                error: result.error.issues[0]?.message ?? "Données invalides",
            });
        }

        const { name, categoryId } = result.data;

        const category = await prisma.event_categories.findUnique({
            where: { id: categoryId },
        });

        if (!category) {
            return reply.status(404).send({ error: "Catégorie non trouvée" });
        }

        const existing = await prisma.event_subcategories.findFirst({
            where: { name: name.trim(), category_id: categoryId },
        });

        if (existing) {
            return reply.status(409).send({ error: "Une sous-catégorie avec ce nom existe déjà dans cette catégorie" });
        }

        const subcategory = await prisma.event_subcategories.create({
            data: {
                name: name.trim(),
                category_id: categoryId,
            },
        });

        return reply.status(201).send({
            id: subcategory.id,
            name: subcategory.name,
            categoryId: subcategory.category_id,
            createdAt: subcategory.created_at,
            updatedAt: subcategory.updated_at,
        });
    });

    app.put("/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const id = parseInt(request.params.id, 10);

        if (isNaN(id)) {
            return reply.status(400).send({ error: "ID invalide" });
        }

        const result = subcategoryUpdateSchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({
                error: result.error.issues[0]?.message ?? "Données invalides",
            });
        }

        const { name } = result.data;

        const existing = await prisma.event_subcategories.findUnique({ where: { id } });

        if (!existing) {
            return reply.status(404).send({ error: "Sous-catégorie non trouvée" });
        }

        const duplicate = await prisma.event_subcategories.findFirst({
            where: { name: name.trim(), category_id: existing.category_id, id: { not: id } },
        });

        if (duplicate) {
            return reply.status(409).send({ error: "Une sous-catégorie avec ce nom existe déjà dans cette catégorie" });
        }

        const subcategory = await prisma.event_subcategories.update({
            where: { id },
            data: { name: name.trim() },
        });

        return reply.send({
            id: subcategory.id,
            name: subcategory.name,
            categoryId: subcategory.category_id,
            createdAt: subcategory.created_at,
            updatedAt: subcategory.updated_at,
        });
    });

    app.delete("/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const id = parseInt(request.params.id, 10);

        if (isNaN(id)) {
            return reply.status(400).send({ error: "ID invalide" });
        }

        const existing = await prisma.event_subcategories.findUnique({ where: { id } });

        if (!existing) {
            return reply.status(404).send({ error: "Sous-catégorie non trouvée" });
        }

        await prisma.event_subcategories.delete({ where: { id } });

        return reply.send({ message: "Sous-catégorie supprimée" });
    });
};
