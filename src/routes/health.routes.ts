import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";

export const healthRoutes = async (app: FastifyInstance) => {
    app.get("/", async (_request: FastifyRequest, reply: FastifyReply) => {
        try {
            await prisma.$queryRaw`SELECT 1`;
            return reply.send({
                status: "ok",
                db: "connected",
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            return reply.status(500).send({
                status: "error",
                db: "disconnected",
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: new Date().toISOString(),
            });
        }
    });
};
