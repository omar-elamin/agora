// Twilio Media Streams → Deepgram WebSocket streaming handler.
// Converts mulaw/8kHz to PCM/16kHz via lookup table, buffers through
// AdaptiveJitterBuffer, and forwards to Deepgram with tight endpointing.

import { AdaptiveJitterBuffer, AudioPacket } from "./jitter-buffer";

// ── mulaw-to-linear16 decode table (ITU G.711) ─────────────────────
const MULAW_DECODE_TABLE = new Int16Array(256);
(function buildTable() {
  for (let i = 0; i < 256; i++) {
    let mu = ~i & 0xff;
    const sign = mu & 0x80 ? -1 : 1;
    mu &= 0x7f;
    const exponent = (mu >> 4) & 0x07;
    const mantissa = mu & 0x0f;
    const magnitude = ((mantissa << 1) | 0x21) << (exponent + 2);
    MULAW_DECODE_TABLE[i] = sign * (magnitude - 0x84);
  }
})();

/** Decode a mulaw byte buffer to signed 16-bit PCM samples. */
function decodeMulaw(mulaw: Buffer): Int16Array {
  const pcm = new Int16Array(mulaw.length);
  for (let i = 0; i < mulaw.length; i++) {
    pcm[i] = MULAW_DECODE_TABLE[mulaw[i]];
  }
  return pcm;
}

/** Upsample 8 kHz → 16 kHz via simple linear interpolation. */
function upsample8to16(samples: Int16Array): Int16Array {
  const out = new Int16Array(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    out[i * 2] = samples[i];
    out[i * 2 + 1] =
      i < samples.length - 1
        ? Math.round((samples[i] + samples[i + 1]) / 2)
        : samples[i];
  }
  return out;
}

// ── Deepgram streaming URL builder ──────────────────────────────────

function buildDeepgramUrl(): string {
  const uttEnd = process.env.DEEPGRAM_UTT_END_MS ?? "500";
  const vadTurnoff = process.env.DEEPGRAM_VAD_TURNOFF_MS ?? "300";

  const params = new URLSearchParams({
    model: "nova-3",
    multichannel: "true",
    smart_format: "true",
    punctuate: "true",
    utterance_end_ms: uttEnd,
    vad_turnoff: vadTurnoff,
    encoding: "linear16",
    sample_rate: "16000",
  });

  return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
}

// ── Latency event ───────────────────────────────────────────────────

export interface LatencyEvent {
  type: "speech_final";
  latency_ms: number;
  sequenceNumber: number;
}

export type LatencyListener = (event: LatencyEvent) => void;

// ── TwilioStreamHandler ─────────────────────────────────────────────

export class TwilioStreamHandler {
  private buffer: AdaptiveJitterBuffer;
  private seq = 0;
  private startTime: number;
  private dgWs: WebSocket | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: LatencyListener[] = [];

  constructor(opts?: {
    bufferDepthMs?: number;
    bufferMaxMs?: number;
  }) {
    this.buffer = new AdaptiveJitterBuffer({
      initialDepthMs: opts?.bufferDepthMs
        ?? Number(process.env.JITTER_BUFFER_DEPTH_MS ?? 20),
      maxDepthMs: opts?.bufferMaxMs
        ?? Number(process.env.JITTER_BUFFER_MAX_MS ?? 150),
    });
    this.startTime = Date.now();
  }

  /** Register a listener for latency events. */
  onLatency(listener: LatencyListener): void {
    this.listeners.push(listener);
  }

  /** Connect to Deepgram streaming WebSocket. */
  async connect(): Promise<void> {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) throw new Error("DEEPGRAM_API_KEY is not set");

    const url = buildDeepgramUrl();

    this.dgWs = new WebSocket(url, {
      // @ts-expect-error Node WebSocket accepts headers in options
      headers: { Authorization: `Token ${apiKey}` },
    });

    await new Promise<void>((resolve, reject) => {
      this.dgWs!.addEventListener("open", () => resolve());
      this.dgWs!.addEventListener("error", (e) => reject(e));
    });

    this.dgWs.addEventListener("message", (event) => {
      this.handleDeepgramMessage(event.data as string);
    });

    // Tick the jitter buffer every 20ms to release ready packets.
    this.tickTimer = setInterval(() => this.tick(), 20);
  }

  /** Accept a raw mulaw chunk from a Twilio Media Streams message. */
  ingestTwilioChunk(mulawBase64: string, twilioTimestamp?: number): void {
    const mulaw = Buffer.from(mulawBase64, "base64");
    const pcm = upsample8to16(decodeMulaw(mulaw));
    const pcmBuf = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);

    const now = Date.now();
    const seqNum = this.seq++;
    const nominalInterval = 100; // Twilio sends ~100ms chunks

    const packet: AudioPacket = {
      data: pcmBuf,
      sequenceNumber: seqNum,
      capturedAt: twilioTimestamp ?? now,
      expectedAt: this.startTime + seqNum * nominalInterval,
    };

    this.buffer.push(packet);
  }

  /** Drain released packets from the buffer and send to Deepgram. */
  private tick(): void {
    const released = this.buffer.tick(Date.now());
    for (const pkt of released) {
      if (this.dgWs?.readyState === WebSocket.OPEN) {
        this.dgWs.send(pkt.data);
      }
    }
  }

  /** Handle a Deepgram transcript message. */
  private handleDeepgramMessage(raw: string): void {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === "Results" && msg.is_final && msg.speech_final) {
        const event: LatencyEvent = {
          type: "speech_final",
          latency_ms: Date.now() - (this.startTime + this.seq * 100),
          sequenceNumber: this.seq,
        };
        for (const l of this.listeners) l(event);
      }
    } catch {
      // ignore non-JSON keepalives
    }
  }

  /** Flush buffer and close connections. */
  async close(): Promise<void> {
    if (this.tickTimer) clearInterval(this.tickTimer);

    // Flush remaining packets
    const remaining = this.buffer.flush();
    for (const pkt of remaining) {
      if (this.dgWs?.readyState === WebSocket.OPEN) {
        this.dgWs.send(pkt.data);
      }
    }

    // Tell Deepgram we're done
    if (this.dgWs?.readyState === WebSocket.OPEN) {
      this.dgWs.send(JSON.stringify({ type: "CloseStream" }));
      this.dgWs.close();
    }
    this.dgWs = null;
  }

  /** Expose buffer stats for monitoring. */
  getBufferStats() {
    return this.buffer.getStats();
  }
}
