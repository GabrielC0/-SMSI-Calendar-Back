import { prisma } from "../lib/prisma.js";

export const repeatTypeMap: Record<string, string> = {
    Jamais: "none",
    "Chaque semaine": "weekly",
    "Chaque mois": "monthly",
    "Chaque trimestre": "quarterly",
    "Chaque semestre": "semestrial",
    "Chaque année": "yearly",
    "Hebdomadaire": "weekly",
    "Mensuel": "monthly",
    "Trimestriel": "quarterly",
    "Semestriel": "semestrial",
    "Annuel": "yearly",
    "Quotidien": "daily",
    none: "none",
    weekly: "weekly",
    monthly: "monthly",
    quarterly: "quarterly",
    semestrial: "semestrial",
    yearly: "yearly",
};

export const alertMinutesMap: Record<string, number | null> = {
    Aucune: null,
    "15 minutes avant": 15,
    "30 minutes avant": 30,
    "1 heure avant": 60,
    "2 heures avant": 120,
    "1 jour avant": 1440,
    "15": 15,
    "30": 30,
    "60": 60,
    "120": 120,
    "1440": 1440,
};

export const emailAlertDaysMap: Record<string, number | null> = {
    Aucune: null,
    "1 jour ouvrable avant": 1,
    "2 jours ouvrables avant": 2,
    "3 jours ouvrables avant": 3,
    "5 jours ouvrables avant": 5,
    "1 semaine ouvrable avant": 5,
    "2 semaines ouvrables avant": 10,
    "1": 1,
    "2": 2,
    "3": 3,
    "5": 5,
    "10": 10,
};

export const parseTags = (input: string): string[] => {
    if (!input || input.trim().length === 0) return [];

    const processedInput = input.trim();
    const finalInput = processedInput;

    if (finalInput.startsWith('[') && finalInput.endsWith(']')) {
        try {
            const parsed = JSON.parse(finalInput);
            if (Array.isArray(parsed)) {
                return parsed.map(t => String(t).trim()).filter(t => t.length > 0);
            }
        } catch (e) {

        }
    }

    if (finalInput.includes("#")) {
        const matches = finalInput.match(/#[\wÀ-ÿ]+/g);
        return matches ? matches.map((tag) => tag.slice(1)) : [];
    }

    if (finalInput.includes(",")) {
        return finalInput.split(",").map((t) => t.trim()).filter((t) => t.length > 0);
    }

    const unquoted = ((finalInput.startsWith('"') && finalInput.endsWith('"')) ||
        (finalInput.startsWith("'") && finalInput.endsWith("'")))
        ? finalInput.slice(1, -1)
        : finalInput;

    return [unquoted.trim()];
};

export const generateRRule = (repeatType: string, repeatEndDate: Date | null): string | null => {
    if (repeatType === "none") return null;

    const repeatMap: Record<string, string> = {
        weekly: "FREQ=WEEKLY",
        monthly: "FREQ=MONTHLY",
        quarterly: "FREQ=MONTHLY;INTERVAL=3",
        semestrial: "FREQ=MONTHLY;INTERVAL=6",
        yearly: "FREQ=YEARLY",
    };

    const rruleBase = repeatMap[repeatType] || "";
    if (!rruleBase) return null;

    const untilPart = repeatEndDate
        ? `;UNTIL=${repeatEndDate.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`
        : "";

    return `${rruleBase}${untilPart}`;
};

export const findOrCreateCategory = async (name: string | undefined): Promise<number | null> => {
    if (!name?.trim()) return null;
    const trimmedName = name.trim();

    const category = await prisma.event_categories.findFirst({
        where: { name: trimmedName },
    });

    if (category) return category.id;

    const newCategory = await prisma.event_categories.create({
        data: { name: trimmedName, color: "#3B82F6" },
    });
    return newCategory.id;
};

export const findOrCreateSubcategory = async (name: string | undefined, categoryId: number | null): Promise<number | null> => {
    if (!name?.trim() || !categoryId) return null;
    const trimmedName = name.trim();

    const subcategory = await prisma.event_subcategories.findFirst({
        where: { name: trimmedName, category_id: categoryId },
    });

    if (subcategory) return subcategory.id;

    return null;
};

export const findOrCreatePlatform = async (name: string | undefined): Promise<number | null> => {
    if (!name?.trim()) return null;
    const trimmedName = name.trim();

    const platform = await prisma.event_platforms.findFirst({
        where: { name: trimmedName },
    });

    if (platform) return platform.id;

    const newPlatform = await prisma.event_platforms.create({
        data: { name: trimmedName, color: "#3B82F6" },
    });
    return newPlatform.id;
};

export const resolveResponsibleId = async (responsible: string | number | undefined): Promise<number | null> => {
    if (!responsible) return null;

    const respId = typeof responsible === "string" ? parseInt(responsible, 10) : responsible;
    if (isNaN(respId)) return null;

    const user = await prisma.users.findUnique({ where: { id: respId } });
    return user ? user.id : null;
};
