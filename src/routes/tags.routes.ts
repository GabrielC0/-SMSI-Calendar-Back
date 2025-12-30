import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";

export const tagsRoutes = async (app: FastifyInstance) => {
    app.get("/", async (_request: FastifyRequest, reply: FastifyReply) => {
        const tags = await prisma.event_tags.findMany({
            select: { tag: true },
            distinct: ["tag"],
            orderBy: { tag: "asc" },
        });

        return reply.send(tags.map((t) => t.tag));
    });
};
