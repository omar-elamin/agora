import { FastifyInstance } from "fastify";
import { getDb } from "../db/setup.js";
import { WaitlistEntry } from "../types.js";

export async function waitlistRoutes(app: FastifyInstance) {
  app.post<{ Body: WaitlistEntry }>("/waitlist", async (request, reply) => {
    const { handle, use_case } = request.body;

    if (!handle || !use_case) {
      return reply.status(400).send({ error: "handle and use_case are required" });
    }

    const db = getDb();
    db.prepare("INSERT INTO waitlist (handle, use_case) VALUES (?, ?)").run(
      handle,
      use_case,
    );

    return { success: true, message: "Added to waitlist" };
  });
}
