import { bronzeFetcher } from "./bronze-fetcher";
import { silverWorker } from "./silver-worker";
import { supabase } from "../../lib/supabase";
import { logger } from "../../lib/logger";

/**
 * Thin orchestrator that chains the Medallion pipeline phases.
 * Used by scripts/run-scraper.ts for a full synchronous run.
 *
 * For production workloads, run the phases independently via
 * scripts/run-fetcher.ts and scripts/run-worker.ts so each can be
 * scheduled and scaled separately.
 */
export class ScraperService {
  async run(): Promise<void> {
    logger.info("[Scraper] Starting Medallion pipeline (Bronze → Silver → Gold)…");

    const { data: run, error: runError } = await supabase
      .from("ingestion_runs")
      .insert({ status: "running" })
      .select("id")
      .single();

    if (runError || !run) {
      logger.error("[Scraper] Could not create ingestion_runs record:", runError?.message);
      return;
    }

    logger.info(`[Scraper] Run ID: ${run.id}`);

    try {
      // ── Phase 1: Bronze — dumb fetch & stable image storage ──────────────
      const bronzeResult = await bronzeFetcher.run();

      await supabase
        .from("ingestion_runs")
        .update({
          posts_scanned:     bronzeResult.postsScanned,
          duplicates_skipped: bronzeResult.duplicatesSkipped,
        })
        .eq("id", run.id);

      // ── Phase 2 + 3: Silver / Gold — intelligence & confidence routing ────
      await silverWorker.run(run.id);

    } catch (error) {
      logger.error("[Scraper] Pipeline error:", error);
      await supabase
        .from("ingestion_runs")
        .update({ ended_at: new Date().toISOString(), status: "failed" })
        .eq("id", run.id);
    }
  }
}

export const scraperService = new ScraperService();
