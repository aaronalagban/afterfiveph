/**
 * Bronze Phase entry point.
 *
 * Run independently of the Silver worker so Instagram fetching and image
 * uploads can be scheduled on a fast, frequent cadence (e.g. every 4 hours)
 * without blocking the heavier AI processing.
 *
 * Usage:
 *   npx ts-node --esm scripts/run-fetcher.ts
 *   # or via package.json script: npm run scrape:fetch
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { bronzeFetcher } from "../src/features/scraper/bronze-fetcher";
import { supabase } from "../src/lib/supabase";
import { logger } from "../src/lib/logger";

async function main() {
  const { data: run, error: runError } = await supabase
    .from("ingestion_runs")
    .insert({ status: "running" })
    .select("id")
    .single();

  if (runError || !run) {
    logger.error("[Fetcher] Failed to create ingestion run:", runError?.message);
    process.exit(1);
  }

  logger.info(`[Fetcher] Bronze phase starting. Run ID: ${run.id}`);

  try {
    const result = await bronzeFetcher.run();

    await supabase
      .from("ingestion_runs")
      .update({
        ended_at:           new Date().toISOString(),
        posts_scanned:      result.postsScanned,
        duplicates_skipped: result.duplicatesSkipped,
        status:             "completed",
      })
      .eq("id", run.id);

    logger.info("[Fetcher] Done.", result);
  } catch (error) {
    logger.error("[Fetcher] Fatal error:", error);
    await supabase
      .from("ingestion_runs")
      .update({ ended_at: new Date().toISOString(), status: "failed" })
      .eq("id", run.id);
    process.exit(1);
  }
}

main();
