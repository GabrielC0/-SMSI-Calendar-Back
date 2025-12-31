import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import { hash } from "bcryptjs";
import { sendWelcomeEmail } from "../lib/email.js";

const generatePassword = (length: number = 12): string => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    return Array.from({ length }, () => charset.charAt(Math.floor(Math.random() * charset.length))).join("");
};

const userCreateSchema = z.object({
    name: z.string().min(1, "Le nom est requis"),
    email: z.string().email("Email invalide").optional().or(z.literal("")),
    role: z.enum(["user", "admin"]).optional(),
    customRoleId: z.number().int().positive().optional(),
    department: z.string().optional(),
    password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères").optional(),
});

const userUpdateSchema = z.object({
    name: z.string().min(1, "Le nom est requis").optional(),
    email: z.string().email("Email invalide").optional().or(z.literal("")),
    role: z.enum(["user", "admin"]).optional(),
    customRoleId: z.number().int().positive().nullable().optional(),
    department: z.string().optional(),
    isActive: z.boolean().optional(),
    password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères").optional(),
});

export const usersRoutes = async (app: FastifyInstance) => {
    app.get("/", async (_request: FastifyRequest, reply: FastifyReply) => {
        const users = await prisma.users.findMany({
            include: {
                permission_roles: { select: { id: true, name: true, color: true } },
            },
            orderBy: { name: "asc" },
        });

        return reply.send(
            users.map((u) => ({
                id: u.id,
                name: u.name,
                email: u.email,
                role: u.role,
                isActive: u.is_active,
                isRootAdmin: u.is_root_admin,
                department: u.department,
                customRoleId: u.custom_role_id,
                customRoleName: u.permission_roles?.name,
                customRoleColor: u.permission_roles?.color,
                lastLogin: u.last_login,
                createdAt: u.created_at,
                updatedAt: u.updated_at,
            })),
        );
    });

    app.get("/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const id = parseInt(request.params.id, 10);

        if (isNaN(id)) {
            return reply.status(400).send({ error: "ID invalide" });
        }

        const user = await prisma.users.findUnique({
            where: { id },
            include: {
                permission_roles: {
                    include: { permission_role_permissions: true },
                },
            },
        });

        if (!user) {
            return reply.status(404).send({ error: "Utilisateur non trouvé" });
        }

        const permissions =
            user.permission_roles?.permission_role_permissions
                .filter((p) => p.has_permission)
                .map((p) => p.permission_type) ?? [];

        return reply.send({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.is_active,
            isRootAdmin: user.is_root_admin,
            department: user.department,
            customRoleId: user.custom_role_id,
            customRole: user.permission_roles
                ? { id: user.permission_roles.id, name: user.permission_roles.name, color: user.permission_roles.color }
                : null,
            permissions,
            lastLogin: user.last_login,
            createdAt: user.created_at,
            updatedAt: user.updated_at,
        });
    });

    app.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
        const result = userCreateSchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({
                error: result.error.issues[0]?.message ?? "Données invalides",
            });
        }

        const { name, email, role, customRoleId, department, password } = result.data;

        const existing = await prisma.users.findFirst({
            where: { name: name.trim() },
        });

        if (existing) {
            return reply.status(409).send({ error: "Un utilisateur avec ce nom existe déjà" });
        }

        if (email) {
            const emailExists = await prisma.users.findFirst({
                where: { email: email.trim() },
            });

            if (emailExists) {
                return reply.status(409).send({ error: "Un utilisateur avec cet email existe déjà" });
            }
        }

        const generatedPassword = password ?? generatePassword();

        if (email?.trim()) {
            console.log(`[Users] Tentative d'envoi d'email de bienvenue à ${email.trim()}...`);
            const emailSent = await sendWelcomeEmail(email.trim(), name.trim(), generatedPassword);
            if (!emailSent) {
                console.error(`[Users] Échec de l'envoi d'email à ${email.trim()} - création utilisateur annulée`);
                return reply.status(500).send({
                    error: "Impossible d'envoyer l'email de bienvenue. Vérifiez la configuration SMTP.",
                });
            }
            console.log(`[Users] Email envoyé avec succès à ${email.trim()}`);
        }

        const passwordHash = await hash(generatedPassword, 10);

        const user = await prisma.users.create({
            data: {
                name: name.trim(),
                email: email?.trim() || null,
                role: role ?? "user",
                custom_role_id: customRoleId ?? null,
                department: department?.trim() || null,
                password_hash: passwordHash,
                must_change_password: true,
            },
        });

        return reply.status(201).send({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.is_active,
            customRoleId: user.custom_role_id,
            department: user.department,
            createdAt: user.created_at,
        });
    });

    app.put("/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const id = parseInt(request.params.id, 10);

        if (isNaN(id)) {
            return reply.status(400).send({ error: "ID invalide" });
        }

        const result = userUpdateSchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({
                error: result.error.issues[0]?.message ?? "Données invalides",
            });
        }

        const existing = await prisma.users.findUnique({ where: { id } });

        if (!existing) {
            return reply.status(404).send({ error: "Utilisateur non trouvé" });
        }

        const { name, email, role, customRoleId, department, isActive, password } = result.data;

        if (name) {
            const duplicate = await prisma.users.findFirst({
                where: { name: name.trim(), id: { not: id } },
            });

            if (duplicate) {
                return reply.status(409).send({ error: "Un utilisateur avec ce nom existe déjà" });
            }
        }

        if (email) {
            const emailDuplicate = await prisma.users.findFirst({
                where: { email: email.trim(), id: { not: id } },
            });

            if (emailDuplicate) {
                return reply.status(409).send({ error: "Un utilisateur avec cet email existe déjà" });
            }
        }

        const emailChanged =
            email !== undefined &&
            email.trim() !== "" &&
            email.trim() !== existing.email;

        const newPassword = emailChanged ? generatePassword() : undefined;

        if (emailChanged && newPassword) {
            console.log(`[Users] Email modifié pour ${name ?? existing.name}, envoi d'un nouveau mot de passe...`);
            const emailSent = await sendWelcomeEmail(
                email.trim(),
                name?.trim() ?? existing.name,
                newPassword,
            );
            if (!emailSent) {
                console.error(`[Users] Échec de l'envoi d'email - modification annulée`);
                return reply.status(500).send({
                    error: "Impossible d'envoyer l'email avec le nouveau mot de passe. Modification annulée.",
                });
            }
        }

        const passwordHash = newPassword
            ? await hash(newPassword, 10)
            : (password ? await hash(password, 10) : undefined);

        const user = await prisma.users.update({
            where: { id },
            data: {
                ...(name !== undefined ? { name: name.trim() } : {}),
                ...(email !== undefined ? { email: email.trim() || null } : {}),
                ...(role !== undefined ? { role } : {}),
                ...(customRoleId !== undefined ? { custom_role_id: customRoleId } : {}),
                ...(department !== undefined ? { department: department.trim() || null } : {}),
                ...(isActive !== undefined ? { is_active: isActive } : {}),
                ...(passwordHash !== undefined ? { password_hash: passwordHash, must_change_password: true } : {}),
            },
        });

        return reply.send({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.is_active,
            customRoleId: user.custom_role_id,
            department: user.department,
            updatedAt: user.updated_at,
            emailSent: emailChanged,
        });
    });

    app.delete("/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const id = parseInt(request.params.id, 10);

        if (isNaN(id)) {
            return reply.status(400).send({ error: "ID invalide" });
        }

        const existing = await prisma.users.findUnique({ where: { id } });

        if (!existing) {
            return reply.status(404).send({ error: "Utilisateur non trouvé" });
        }

        if (existing.is_root_admin) {
            return reply.status(403).send({ error: "Impossible de supprimer le super-administrateur" });
        }

        await prisma.users.delete({ where: { id } });

        return reply.send({ message: "Utilisateur supprimé" });
    });
};
