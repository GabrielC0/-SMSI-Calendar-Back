import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

type EmailConfig = {
    host: string;
    port: number;
    secure: boolean;
    auth: {
        user: string;
        pass: string;
    };
    from: string;
};

const getEmailConfig = (): EmailConfig => ({
    host: process.env.SMTP_HOST ?? "smtp.example.com",
    port: parseInt(process.env.SMTP_PORT ?? "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
        user: process.env.SMTP_USER ?? "",
        pass: process.env.SMTP_PASSWORD ?? process.env.SMTP_PASS ?? "",
    },
    from: process.env.SMTP_FROM_NAME
        ? `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM}>`
        : process.env.SMTP_FROM ?? "SMSI Calendar <noreply@example.com>",
});

const createTransporter = (): Transporter => {
    const config = getEmailConfig();
    return nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
            user: config.auth.user,
            pass: config.auth.pass,
        },
    });
};

export const sendWelcomeEmail = async (
    email: string,
    name: string,
    password: string,
): Promise<boolean> => {
    const config = getEmailConfig();

    if (!config.auth.user || !config.auth.pass) {
        console.warn("[Email] SMTP non configuré - email non envoyé");
        return false;
    }

    const transporter = createTransporter();

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; }
        .credentials { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #e2e8f0; }
        .password { font-family: monospace; font-size: 18px; background: #fef3c7; padding: 10px; border-radius: 4px; text-align: center; }
        .footer { text-align: center; padding: 15px; color: #64748b; font-size: 12px; }
        .warning { background: #fef2f2; border: 1px solid #fecaca; padding: 10px; border-radius: 4px; color: #dc2626; margin-top: 15px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Bienvenue sur SMSI Calendar</h1>
        </div>
        <div class="content">
            <p>Bonjour <strong>${name}</strong>,</p>
            <p>Votre compte a été créé avec succès. Voici vos identifiants de connexion :</p>
            <div class="credentials">
                <p><strong>Identifiant :</strong> ${name}</p>
                <p><strong>Mot de passe temporaire :</strong></p>
                <div class="password">${password}</div>
            </div>
            <div class="warning">
                ⚠️ Pour des raisons de sécurité, vous devrez changer ce mot de passe lors de votre première connexion.
            </div>
        </div>
        <div class="footer">
            <p>Cet email a été envoyé automatiquement par SMSI Calendar.</p>
        </div>
    </div>
</body>
</html>
    `;

    try {
        await transporter.sendMail({
            from: config.from,
            to: email,
            subject: "Bienvenue sur SMSI Calendar - Vos identifiants",
            html,
        });
        console.log(`[Email] Email de bienvenue envoyé à ${email}`);
        return true;
    } catch (error) {
        console.error("[Email] Erreur lors de l'envoi:", error);
        return false;
    }
};

export const sendEventReminderEmail = async (
    email: string,
    userName: string,
    eventTitle: string,
    eventDate: Date,
    daysRemaining: number,
): Promise<boolean> => {
    const config = getEmailConfig();

    if (!config.auth.user || !config.auth.pass) {
        console.warn("[Email] SMTP non configuré - rappel non envoyé");
        return false;
    }

    const transporter = createTransporter();

    const formattedDate = eventDate.toLocaleDateString("fr-FR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    const urgencyColor = daysRemaining <= 1 ? "#dc2626" : daysRemaining <= 3 ? "#f59e0b" : "#22c55e";

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; }
        .event-box { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid ${urgencyColor}; }
        .days-badge { display: inline-block; background: ${urgencyColor}; color: white; padding: 5px 15px; border-radius: 20px; font-weight: bold; }
        .footer { text-align: center; padding: 15px; color: #64748b; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔔 Rappel d'événement</h1>
        </div>
        <div class="content">
            <p>Bonjour <strong>${userName}</strong>,</p>
            <p>Ceci est un rappel pour l'événement suivant :</p>
            <div class="event-box">
                <h2 style="margin-top: 0;">${eventTitle}</h2>
                <p><strong>📅 Date :</strong> ${formattedDate}</p>
                <p><span class="days-badge">${daysRemaining === 0 ? "Aujourd'hui !" : daysRemaining === 1 ? "Demain !" : `Dans ${daysRemaining} jours`}</span></p>
            </div>
        </div>
        <div class="footer">
            <p>Cet email a été envoyé automatiquement par SMSI Calendar.</p>
        </div>
    </div>
</body>
</html>
    `;

    try {
        await transporter.sendMail({
            from: config.from,
            to: email,
            subject: `🔔 Rappel : ${eventTitle} - ${daysRemaining === 0 ? "Aujourd'hui" : daysRemaining === 1 ? "Demain" : `Dans ${daysRemaining} jours`}`,
            html,
        });
        console.log(`[Email] Rappel envoyé à ${email} pour "${eventTitle}"`);
        return true;
    } catch (error) {
        console.error("[Email] Erreur lors de l'envoi du rappel:", error);
        return false;
    }
};

export const testEmailConnection = async (): Promise<boolean> => {
    const config = getEmailConfig();

    if (!config.auth.user || !config.auth.pass) {
        console.warn("[Email] SMTP non configuré");
        return false;
    }

    const transporter = createTransporter();

    try {
        await transporter.verify();
        console.log("[Email] Connexion SMTP vérifiée avec succès");
        return true;
    } catch (error) {
        console.error("[Email] Échec de la vérification SMTP:", error);
        return false;
    }
};
