import "dotenv/config";
import Fastify from "fastify";
import { evalRoutes } from "./routes/eval.js";
import { vendorRoutes } from "./routes/vendors.js";
import { waitlistRoutes } from "./routes/waitlist.js";

const app = Fastify({ logger: true });

app.register(evalRoutes);
app.register(vendorRoutes);
app.register(waitlistRoutes);

app.get("/health", async () => ({ status: "ok" }));

const port = parseInt(process.env.PORT || "3000", 10);

app.listen({ port, host: "0.0.0.0" }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
