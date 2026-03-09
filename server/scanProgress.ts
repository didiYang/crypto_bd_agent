/**
 * Scan Progress SSE (Server-Sent Events) Module
 *
 * Provides real-time scan progress updates to the frontend via SSE.
 * The scan process emits progress events through this module,
 * and the frontend subscribes to /api/scan-progress to receive them.
 */

import type { Express, Request, Response } from "express";

// ─── Event Bus ────────────────────────────────────────────────────────────────
type ProgressListener = (event: ScanProgressEvent) => void;
const listeners = new Set<ProgressListener>();

export type ScanProgressEvent =
  | { type: "start"; totalPages: number; daysBack: number }
  | { type: "page"; page: number; totalPages: number; found: number; total: number }
  | { type: "project"; name: string; symbol: string; isMeme: boolean; isNew: boolean }
  | { type: "done"; total: number; newCount: number; updatedCount: number; daysBack: number }
  | { type: "error"; message: string };

export function emitScanProgress(event: ScanProgressEvent) {
  for (const listener of Array.from(listeners)) {
    listener(event);
  }
}

// ─── SSE Route ────────────────────────────────────────────────────────────────
export function registerScanProgressRoute(app: Express) {
  app.get("/api/scan-progress", (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    // Send a heartbeat immediately to confirm connection
    res.write("data: {\"type\":\"connected\"}\n\n");

    const listener: ProgressListener = (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    listeners.add(listener);

    // Clean up when client disconnects
    req.on("close", () => {
      listeners.delete(listener);
    });
  });
}
