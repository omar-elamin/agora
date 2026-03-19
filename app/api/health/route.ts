import { corsJson, corsOptions } from "@/lib/cors";

export async function OPTIONS() {
  return corsOptions();
}

export async function GET() {
  return corsJson({ status: "ok", version: "0.1.0" });
}
