import { z } from "zod";

export const loginSchema = z.object({
    identifier: z.string().min(1, "Identifiant requis"),
    password: z.string().min(1, "Mot de passe requis"),
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, "Mot de passe actuel requis"),
    newPassword: z.string().min(6, "Le nouveau mot de passe doit contenir au moins 6 caractères"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
