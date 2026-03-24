import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AdaptiveJitterBuffer,
  AudioPacket,
  updateDepthEstimate,
  shouldDrop,
} from "../jitter-buffer";

function makePacket(
  seq: number,
  expectedAt: number,
  data?: Buffer,
): AudioPacket {
  return {
    data: data ?? Buffer.alloc(160),
    sequenceNumber: seq,
    capturedAt: expectedAt,
    expectedAt,
  };
}

describe("AdaptiveJitterBuffer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Test 1: Clean path ──────────────────────────────────────────
  it("releases all packets with near-zero depth when there is no jitter", () => {
    const startTime = 1000;
    vi.setSystemTime(startTime);

    const buf = new AdaptiveJitterBuffer({
      nominalIntervalMs: 100,
      initialDepthMs: 0,
      minDepthMs: 0,
      maxDepthMs: 150,
      alpha: 0.125,
      dropThresholdMultiplier: 2.0,
    });

    // Push 10 packets at exact 100ms intervals — Date.now() matches expectedAt
    for (let i = 0; i < 10; i++) {
      const t = startTime + i * 100;
      vi.setSystemTime(t);
      buf.push(makePacket(i, t));
    }

    // Tick at the time of the last packet
    vi.setSystemTime(startTime + 9 * 100);
    const released = buf.tick(Date.now());

    expect(released.length).toBe(10);
    expect(buf.getStats().depthMs).toBeLessThan(5); // stays near 0
    expect(buf.getStats().totalDropped).toBe(0);
  });

  // ── Test 2: Jitter path ─────────────────────────────────────────
  it("adapts depth under 0-50ms jitter and keeps overhead < 500ms", () => {
    const startTime = 1000;

    const buf = new AdaptiveJitterBuffer({
      nominalIntervalMs: 100,
      initialDepthMs: 20,
      minDepthMs: 0,
      maxDepthMs: 150,
      alpha: 0.125,
      dropThresholdMultiplier: 2.0,
    });

    // Simulate 50 packets with random 0-50ms arrival jitter
    const arrivals: number[] = [];
    for (let i = 0; i < 50; i++) {
      const expectedAt = startTime + i * 100;
      const jitter = Math.floor(Math.random() * 50); // 0-50ms late
      const arriveAt = expectedAt + jitter;
      arrivals.push(arriveAt);

      vi.setSystemTime(arriveAt);
      buf.push(makePacket(i, expectedAt));
    }

    // Tick well past all packets
    vi.setSystemTime(startTime + 50 * 100 + 200);
    const released = buf.tick(Date.now());

    expect(released.length).toBe(50);
    expect(buf.getStats().depthMs).toBeLessThan(500);
    expect(buf.getStats().totalDropped).toBe(0);
  });

  // ── Test 3: Drop logic ──────────────────────────────────────────
  it("drops packets arriving more than 2x nominal interval late", () => {
    const startTime = 1000;

    const buf = new AdaptiveJitterBuffer({
      nominalIntervalMs: 100,
      dropThresholdMultiplier: 2.0,
      initialDepthMs: 20,
      minDepthMs: 0,
      maxDepthMs: 150,
      alpha: 0.125,
    });

    // On-time packet
    vi.setSystemTime(startTime);
    buf.push(makePacket(0, startTime));

    // Very late packet: expectedAt=startTime+100, arrives at startTime+350 → 250ms late > 200ms
    vi.setSystemTime(startTime + 350);
    buf.push(makePacket(1, startTime + 100));

    expect(buf.getStats().totalDropped).toBe(1);
    expect(buf.getStats().queueLength).toBe(1); // only packet 0
  });

  // ── Test 4: Flush ───────────────────────────────────────────────
  it("releases all queued packets immediately on flush", () => {
    const startTime = 1000;
    vi.setSystemTime(startTime);

    const buf = new AdaptiveJitterBuffer({ initialDepthMs: 100 });

    // Push packets but don't tick (they stay queued due to depth)
    for (let i = 0; i < 5; i++) {
      vi.setSystemTime(startTime + i * 100);
      buf.push(makePacket(i, startTime + i * 100));
    }

    // Without advancing time far enough, tick would not release all
    const tickReleased = buf.tick(startTime + 200);
    const remaining = buf.getStats().queueLength;
    expect(remaining).toBeGreaterThan(0);

    // Flush releases everything
    const flushed = buf.flush();
    expect(flushed.length).toBe(remaining);
    expect(buf.getStats().queueLength).toBe(0);
  });

  // ── Test 5: Stats — dropped counter ─────────────────────────────
  it("increments dropped counter for each dropped packet", () => {
    const startTime = 1000;

    const buf = new AdaptiveJitterBuffer({
      nominalIntervalMs: 100,
      dropThresholdMultiplier: 2.0,
      initialDepthMs: 0,
      minDepthMs: 0,
      maxDepthMs: 150,
      alpha: 0.125,
    });

    // Drop 3 late packets
    for (let i = 0; i < 3; i++) {
      const expectedAt = startTime + i * 100;
      vi.setSystemTime(expectedAt + 250); // 250ms late > 200ms threshold
      buf.push(makePacket(i, expectedAt));
    }

    const stats = buf.getStats();
    expect(stats.totalDropped).toBe(3);
    expect(stats.queueLength).toBe(0);
  });

  // ── Unit: updateDepthEstimate ───────────────────────────────────
  it("updateDepthEstimate clamps between min and max", () => {
    const config = {
      nominalIntervalMs: 100,
      initialDepthMs: 20,
      minDepthMs: 10,
      maxDepthMs: 50,
      dropThresholdMultiplier: 2.0,
      alpha: 0.5,
    };

    vi.setSystemTime(1000);
    // Packet expected at 1000, arriving at 1000 → jitter = 0
    const low = updateDepthEstimate(makePacket(0, 1000), 20, config);
    expect(low).toBeGreaterThanOrEqual(10);

    // Packet with huge jitter → clamped at max
    vi.setSystemTime(2000);
    const high = updateDepthEstimate(makePacket(1, 500), 40, config);
    expect(high).toBeLessThanOrEqual(50);
  });

  // ── Unit: shouldDrop ────────────────────────────────────────────
  it("shouldDrop returns false for on-time packets", () => {
    vi.setSystemTime(1000);
    const config = {
      nominalIntervalMs: 100,
      initialDepthMs: 20,
      minDepthMs: 0,
      maxDepthMs: 150,
      dropThresholdMultiplier: 2.0,
      alpha: 0.125,
    };
    expect(shouldDrop(makePacket(0, 1000), config)).toBe(false);
    expect(shouldDrop(makePacket(1, 850), config)).toBe(false); // 150ms late, < 200
  });
});
