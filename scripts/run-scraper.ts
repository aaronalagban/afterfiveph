import dotenv from "dotenv";
import { scraperService } from "../src/features/scraper/scraper.service";
import { logger } from "../src/lib/logger";

dotenv.config({ path: ".env.local" });

async function main() {
  try {
    await scraperService.run();
  } catch (error) {
    logger.error("Fatal error during scraper run:", error);
    process.exit(1);
  }
}

main();
