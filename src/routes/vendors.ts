import { FastifyInstance } from "fastify";
import { vendorRegistry } from "../vendors/registry.js";

export async function vendorRoutes(app: FastifyInstance) {
  app.get("/vendors", async () => {
    return {
      vendors: Object.values(vendorRegistry).map((v) => v.info),
    };
  });
}
