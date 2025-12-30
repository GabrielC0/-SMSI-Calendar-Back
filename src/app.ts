import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";

import { authRoutes } from "./routes/auth.routes.js";
import { eventsRoutes } from "./routes/events.routes.js";
import { categoriesRoutes } from "./routes/categories.routes.js";
import { subcategoriesRoutes } from "./routes/subcategories.routes.js";
import { platformsRoutes } from "./routes/platforms.routes.js";
import { usersRoutes } from "./routes/users.routes.js";
import { rolesRoutes } from "./routes/roles.routes.js";
import { settingsRoutes } from "./routes/settings.routes.js";
import { tagsRoutes } from "./routes/tags.routes.js";
import { calendarRoutes } from "./routes/calendar.routes.js";
import { healthRoutes } from "./routes/health.routes.js";

const app = Fastify({
    logger: process.env["NODE_ENV"] !== "production",
});

const startServer = async () => {
    await app.register(cors, {
        origin: process.env["CORS_ORIGIN"] ?? "http://localhost:3000",
        credentials: true,
    });

    await app.register(cookie);

    await app.register(jwt, {
        secret: process.env["JWT_SECRET"] ?? "default-secret-change-me",
        cookie: {
            cookieName: "token",
            signed: false,
        },
    });

    await app.register(authRoutes, { prefix: "/auth" });
    await app.register(eventsRoutes, { prefix: "/events" });
    await app.register(categoriesRoutes, { prefix: "/categories" });
    await app.register(subcategoriesRoutes, { prefix: "/subcategories" });
    await app.register(platformsRoutes, { prefix: "/platforms" });
    await app.register(usersRoutes, { prefix: "/users" });
    await app.register(rolesRoutes, { prefix: "/roles" });
    await app.register(settingsRoutes, { prefix: "/settings" });
    await app.register(tagsRoutes, { prefix: "/tags" });
    await app.register(calendarRoutes, { prefix: "/calendar" });
    await app.register(healthRoutes, { prefix: "/health" });

    const port = parseInt(process.env["PORT"] ?? "3001", 10);
    const host = process.env["HOST"] ?? "0.0.0.0";

    try {
        await app.listen({ port, host });
        console.log(`🚀 Server running at http://${host}:${port}`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

startServer();
