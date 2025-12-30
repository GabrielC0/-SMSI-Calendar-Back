import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";

const PERMISSION_TYPES = [
    "events_create",
    "events_edit",
    "events_delete",
    "events_status_edit",
    "categories_create",
    "categories_edit",
    "categories_delete",
    "platforms_create",
    "platforms_edit",
    "platforms_delete",
    "users_create",
    "users_edit",
    "users_delete",
    "warnings_edit",
    "unplanned_view",
    "unplanned_edit",
    "unplanned_create",
] as const;

const roleCreateSchema = z.object({
    name: z.string().min(1, "Le nom est requis"),
    description: z.string().optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Couleur invalide").optional(),
    permissions: z.record(z.boolean()).optional(),
});

const roleUpdateSchema = z.object({
    name: z.string().min(1, "Le nom est requis").optional(),
    description: z.string().optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Couleur invalide").optional(),
    permissions: z.record(z.boolean()).optional(),
});

export const rolesRoutes = async (app: FastifyInstance) => {
    app.get("/", async (_request: FastifyRequest, reply: FastifyReply) => {
        const roles = await prisma.permission_roles.findMany({
            include: {
                permission_role_permissions: true,
                _count: { select: { users: true } },
            },
            orderBy: { name: "asc" },
        });

        return reply.send(
            roles.map((r) => {
                const permissions: Record<string, boolean> = {};
                for (const p of r.permission_role_permissions) {
                    permissions[p.permission_type] = p.has_permission ?? false;
                }

                return {
                    id: r.id,
                    name: r.name,
                    description: r.description,
                    color: r.color,
                    permissions,
                    userCount: r._count.users,
                    createdAt: r.created_at,
                    updatedAt: r.updated_at,
                };
            }),
        );
    });

    app.get("/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const id = parseInt(request.params.id, 10);

        if (isNaN(id)) {
            return reply.status(400).send({ error: "ID invalide" });
        }

        const role = await prisma.permission_roles.findUnique({
            where: { id },
            include: {
                permission_role_permissions: true,
                _count: { select: { users: true } },
            },
        });

        if (!role) {
            return reply.status(404).send({ error: "Rôle non trouvé" });
        }

        const permissions: Record<string, boolean> = {};
        for (const p of role.permission_role_permissions) {
            permissions[p.permission_type] = p.has_permission ?? false;
        }

        return reply.send({
            id: role.id,
            name: role.name,
            description: role.description,
            color: role.color,
            permissions,
            userCount: role._count.users,
            createdAt: role.created_at,
            updatedAt: role.updated_at,
        });
    });

    app.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
        const result = roleCreateSchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({
                error: result.error.issues[0]?.message ?? "Données invalides",
            });
        }

        const { name, description, color, permissions } = result.data;

        const existing = await prisma.permission_roles.findFirst({
            where: { name: name.trim() },
        });

        if (existing) {
            return reply.status(409).send({ error: "Un rôle avec ce nom existe déjà" });
        }

        const role = await prisma.permission_roles.create({
            data: {
                name: name.trim(),
                description: description?.trim() || null,
                color: color ?? "#3B82F6",
            },
        });

        if (permissions) {
            const permissionData = PERMISSION_TYPES.map((type) => ({
                role_id: role.id,
                permission_type: type,
                has_permission: permissions[type] ?? false,
            }));

            await prisma.permission_role_permissions.createMany({
                data: permissionData,
            });
        }

        return reply.status(201).send({
            id: role.id,
            name: role.name,
            description: role.description,
            color: role.color,
            createdAt: role.created_at,
        });
    });

    app.put("/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const id = parseInt(request.params.id, 10);

        if (isNaN(id)) {
            return reply.status(400).send({ error: "ID invalide" });
        }

        const result = roleUpdateSchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({
                error: result.error.issues[0]?.message ?? "Données invalides",
            });
        }

        const existing = await prisma.permission_roles.findUnique({ where: { id } });

        if (!existing) {
            return reply.status(404).send({ error: "Rôle non trouvé" });
        }

        const { name, description, color, permissions } = result.data;

        if (name) {
            const duplicate = await prisma.permission_roles.findFirst({
                where: { name: name.trim(), id: { not: id } },
            });

            if (duplicate) {
                return reply.status(409).send({ error: "Un rôle avec ce nom existe déjà" });
            }
        }

        const role = await prisma.permission_roles.update({
            where: { id },
            data: {
                ...(name !== undefined ? { name: name.trim() } : {}),
                ...(description !== undefined ? { description: description.trim() || null } : {}),
                ...(color !== undefined ? { color } : {}),
            },
        });

        if (permissions) {
            for (const [permType, hasPermission] of Object.entries(permissions)) {
                await prisma.permission_role_permissions.upsert({
                    where: {
                        unique_role_permission: { role_id: id, permission_type: permType },
                    },
                    update: { has_permission: hasPermission },
                    create: {
                        role_id: id,
                        permission_type: permType,
                        has_permission: hasPermission,
                    },
                });
            }
        }

        return reply.send({
            id: role.id,
            name: role.name,
            description: role.description,
            color: role.color,
            updatedAt: role.updated_at,
        });
    });

    app.delete("/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const id = parseInt(request.params.id, 10);

        if (isNaN(id)) {
            return reply.status(400).send({ error: "ID invalide" });
        }

        const existing = await prisma.permission_roles.findUnique({ where: { id } });

        if (!existing) {
            return reply.status(404).send({ error: "Rôle non trouvé" });
        }

        if (existing.name === "Admin" || existing.name === "User") {
            return reply.status(403).send({ error: "Impossible de supprimer les rôles par défaut Admin/User" });
        }

        await prisma.permission_roles.delete({ where: { id } });

        return reply.send({ message: "Rôle supprimé" });
    });
};
