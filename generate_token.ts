
import Fastify from "fastify";
import jwt from "@fastify/jwt";

const app = Fastify();
app.register(jwt, {
    secret: "default-secret-change-me"
});

app.ready().then(() => {
    const token = app.jwt.sign({ userId: 1 });
    console.log("TOKEN:" + token);
    process.exit(0);
});
