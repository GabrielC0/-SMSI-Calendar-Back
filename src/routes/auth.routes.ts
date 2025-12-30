import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { compare, hash } from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { loginSchema, changePasswordSchema } from "../schemas/auth.schema.js";

type JwtPayload = {
    userId: number;
    email: string | null;
    name: string;
    role: "user" | "admin";
    customRoleId: number | null;
};

export const authRoutes = async (app: FastifyInstance) => {
    app.post("/login", async (request: FastifyRequest, reply: FastifyReply) => {
        const result = loginSchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({
                error: result.error.issues[0]?.message ?? "Données invalides",
            });
        }

        const { identifier, password } = result.data;

        const user = await prisma.users.findFirst({
            where: { name: identifier.trim() },
            include: {
                permission_roles: {
                    include: {
                        permission_role_permissions: true,
                    },
                },
            },
        });

        if (!user) {
            return reply.status(404).send({
                error: "Aucun utilisateur trouvé avec cet identifiant",
            });
        }

        if (!user.is_active) {
            return reply.status(403).send({
                error: "Ce compte est désactivé",
            });
        }

        if (!user.password_hash) {
            return reply.status(400).send({
                error: "Ce compte n'a pas encore de mot de passe configuré. Contactez un administrateur.",
            });
        }

        const isValidPassword = await compare(password, user.password_hash);

        if (!isValidPassword) {
            return reply.status(401).send({
                error: "Identifiant ou mot de passe incorrect",
            });
        }

        if (user.must_change_password && !user.is_root_admin) {
            return reply.send({
                passwordChangeRequired: true,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role ?? "user",
                },
            });
        }

        await prisma.users.update({
            where: { id: user.id },
            data: { last_login: new Date() },
        });

        const payload: JwtPayload = {
            userId: user.id,
            email: user.email,
            name: user.name,
            role: user.role ?? "user",
            customRoleId: user.custom_role_id,
        };

        const token = app.jwt.sign(payload, { expiresIn: "7d" });

        reply.setCookie("token", token, {
            httpOnly: true,
            secure: process.env["NODE_ENV"] === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 7,
            path: "/",
        });

        const permissions =
            user.permission_roles?.permission_role_permissions
                .filter((p) => p.has_permission)
                .map((p) => p.permission_type) ?? [];

        return reply.send({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role ?? "user",
                customRoleId: user.custom_role_id,
                permissions,
            },
            token,
        });
    });

    app.post("/logout", async (_request: FastifyRequest, reply: FastifyReply) => {
        reply.clearCookie("token", { path: "/" });
        return reply.send({ message: "Déconnexion réussie" });
    });

    app.get("/me", async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            await request.jwtVerify();
        } catch {
            return reply.status(401).send({ error: "Non authentifié" });
        }

        const payload = request.user as JwtPayload;

        const user = await prisma.users.findUnique({
            where: { id: payload.userId },
            include: {
                permission_roles: {
                    include: {
                        permission_role_permissions: true,
                    },
                },
            },
        });

        if (!user) {
            return reply.status(404).send({ error: "Utilisateur non trouvé" });
        }

        if (!user.is_active) {
            return reply.status(403).send({ error: "Ce compte est désactivé" });
        }

        const permissions =
            user.permission_roles?.permission_role_permissions
                .filter((p) => p.has_permission)
                .map((p) => p.permission_type) ?? [];

        return reply.send({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role ?? "user",
                customRoleId: user.custom_role_id,
                permissions,
            },
        });
    });

    app.post("/change-password", async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            await request.jwtVerify();
        } catch {
            return reply.status(401).send({ error: "Non authentifié" });
        }

        const payload = request.user as JwtPayload;

        const result = changePasswordSchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({
                error: result.error.issues[0]?.message ?? "Données invalides",
            });
        }

        const { currentPassword, newPassword } = result.data;

        const user = await prisma.users.findUnique({
            where: { id: payload.userId },
        });

        if (!user) {
            return reply.status(404).send({ error: "Utilisateur non trouvé" });
        }

        if (!user.password_hash) {
            return reply.status(400).send({ error: "Aucun mot de passe configuré" });
        }

        const isValidPassword = await compare(currentPassword, user.password_hash);

        if (!isValidPassword) {
            return reply.status(401).send({ error: "Mot de passe actuel incorrect" });
        }

        const newPasswordHash = await hash(newPassword, 10);

        await prisma.users.update({
            where: { id: user.id },
            data: {
                password_hash: newPasswordHash,
                must_change_password: false,
            },
        });

        return reply.send({ message: "Mot de passe modifié avec succès" });
    });
};
