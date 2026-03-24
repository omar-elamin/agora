// Adaptive jitter buffer for real-time audio streaming.
// Smooths arrival-time variance so downstream consumers (Deepgram WS)
// receive a steady packet cadence even when the network is jittery.

export interface JitterBufferConfig {
  nominalIntervalMs: number;        // expected inter-packet gap (default: 100)
  initialDepthMs: number;           // starting buffer depth    (default: 20)
  minDepthMs: number;               // floor                    (default: 0)
  maxDepthMs: number;               // ceiling                  (default: 150)
  dropThresholdMultiplier: number;  // drop if late > multiplier * nominal (default: 2.0)
  alpha: number;                    // EWMA smoothing factor    (default: 0.125)
}

export interface AudioPacket {
  data: Buffer;
  sequenceNumber: number;
  capturedAt: number;   // timestamp when Twilio captured the audio
  expectedAt: number;   // when the packet should have arrived (capturedAt + nominalInterval * n)
}

export interface JitterBufferStats {
  depthMs: number;
  queueLength: number;
  totalDropped: number;
  totalReordered: number;
}

const DEFAULT_CONFIG: JitterBufferConfig = {
  nominalIntervalMs: 100,
  initialDepthMs: 20,
  minDepthMs: 0,
  maxDepthMs: 150,
  dropThresholdMultiplier: 2.0,
  alpha: 0.125,
};

/** EWMA update: blend observed jitter into the running depth estimate. */
export function updateDepthEstimate(
  packet: AudioPacket,
  currentDepthMs: number,
  config: JitterBufferConfig,
): number {
  const jitter = Math.abs(Date.now() - packet.expectedAt);
  const next = config.alpha * jitter + (1 - config.alpha) * currentDepthMs;
  return Math.max(config.minDepthMs, Math.min(config.maxDepthMs, next));
}

/** Returns true if the packet is too late to be useful. */
export function shouldDrop(packet: AudioPacket, config: JitterBufferConfig): boolean {
  const lateBy = Date.now() - packet.expectedAt;
  return lateBy > config.dropThresholdMultiplier * config.nominalIntervalMs;
}

export class AdaptiveJitterBuffer {
  private queue: AudioPacket[] = [];
  private depthMs: number;
  private config: JitterBufferConfig;
  private lastSeq = -1;

  // metrics
  private dropped = 0;
  private reordered = 0;

  constructor(config?: Partial<JitterBufferConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.depthMs = this.config.initialDepthMs;
  }

  /** Enqueue a packet. Drops late arrivals and tracks reordering. */
  push(packet: AudioPacket): void {
    if (shouldDrop(packet, this.config)) {
      this.dropped++;
      return;
    }

    this.depthMs = updateDepthEstimate(packet, this.depthMs, this.config);

    // detect reorder
    if (packet.sequenceNumber < this.lastSeq) {
      this.reordered++;
    }
    this.lastSeq = Math.max(this.lastSeq, packet.sequenceNumber);

    this.queue.push(packet);
    this.queue.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  }

  /** Release packets whose playout time has passed. */
  tick(nowMs: number): AudioPacket[] {
    const ready: AudioPacket[] = [];
    const remaining: AudioPacket[] = [];

    for (const pkt of this.queue) {
      if (pkt.expectedAt + this.depthMs <= nowMs) {
        ready.push(pkt);
      } else {
        remaining.push(pkt);
      }
    }

    this.queue = remaining;
    return ready;
  }

  /** Release every queued packet immediately (e.g. call end). */
  flush(): AudioPacket[] {
    const all = this.queue.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    this.queue = [];
    return all;
  }

  getStats(): JitterBufferStats {
    return {
      depthMs: this.depthMs,
      queueLength: this.queue.length,
      totalDropped: this.dropped,
      totalReordered: this.reordered,
    };
  }
}
