/**
 * Silver / Gold Phase entry point.
 *
 * Processes all pending_events rows that the Bronze fetcher staged but the
 * intelligence worker has not yet touched (status = 'PENDING', ai_raw_response IS NULL).
 *
 * Run this after run-fetcher.ts, or on its own schedule when you want to drain
 * the processing queue without triggering a fresh Instagram scrape.
 *
 * Usage:
 *   npx ts-node --esm scripts/run-worker.ts
 *   # or via package.json script: npm run scrape:work
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { silverWorker } from "../src/features/scraper/silver-worker";
import { supabase } from "../src/lib/supabase";
import { logger } from "../src/lib/logger";

async function main() {
  const { data: run, error: runError } = await supabase
    .from("ingestion_runs")
    .insert({ status: "running" })
    .select("id")
    .single();

  if (runError || !run) {
    logger.error("[Worker] Failed to create ingestion run:", runError?.message);
    process.exit(1);
  }

  logger.info(`[Worker] Silver phase starting. Run ID: ${run.id}`);

  try {
    const result = await silverWorker.run(run.id);
    logger.info("[Worker] Done.", result);
  } catch (error) {
    logger.error("[Worker] Fatal error:", error);
    await supabase
      .from("ingestion_runs")
      .update({ ended_at: new Date().toISOString(), status: "failed" })
      .eq("id", run.id);
    process.exit(1);
  }
}

main();
