import { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../db/setup.js";
import { vendorRegistry } from "../vendors/registry.js";
import { EvalRequest, TranscriptionResult } from "../types.js";

export async function evalRoutes(app: FastifyInstance) {
  app.post<{ Body: EvalRequest }>("/eval/transcription", async (request, reply) => {
    const { audio_url, vendors } = request.body;

    if (!audio_url || !vendors?.length) {
      return reply.status(400).send({ error: "audio_url and vendors[] are required" });
    }

    const unknown = vendors.filter((v) => !(v in vendorRegistry));
    if (unknown.length) {
      return reply.status(400).send({ error: `Unknown vendors: ${unknown.join(", ")}` });
    }

    const results: TranscriptionResult[] = await Promise.all(
      vendors.map(async (vendorName) => {
        const vendor = vendorRegistry[vendorName];
        const start = performance.now();
        const { transcript, duration_seconds } = await vendor.transcribe(audio_url);
        const latency_ms = Math.round(performance.now() - start);

        const wordCount = transcript.split(/\s+/).filter(Boolean).length;
        const audioDurationMin = duration_seconds / 60;
        const cost_usd = parseFloat(
          (audioDurationMin * vendor.info.pricing.per_minute_usd).toFixed(6),
        );
        const words_per_second = duration_seconds > 0
          ? parseFloat((wordCount / duration_seconds).toFixed(2))
          : 0;

        return {
          vendor: vendorName,
          transcript,
          latency_ms,
          cost_usd,
          words_per_second,
        };
      }),
    );

    const id = uuidv4();
    const db = getDb();
    db.prepare(
      "INSERT INTO evals (id, audio_url, results) VALUES (?, ?, ?)",
    ).run(id, audio_url, JSON.stringify(results));

    return { id, audio_url, results };
  });

  app.get<{ Params: { id: string } }>("/evals/:id", async (request, reply) => {
    const db = getDb();
    const row = db
      .prepare("SELECT * FROM evals WHERE id = ?")
      .get(request.params.id) as { id: string; audio_url: string; results: string; created_at: string } | undefined;

    if (!row) {
      return reply.status(404).send({ error: "Eval not found" });
    }

    return {
      id: row.id,
      audio_url: row.audio_url,
      results: JSON.parse(row.results),
      created_at: row.created_at,
    };
  });
}
