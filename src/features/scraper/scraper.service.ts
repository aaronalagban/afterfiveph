import { instagramClient } from "./instagram.client";
import { imageService } from "./image.service";
import { classifier } from "./classifier";
import { validator } from "./validator";
import { eventService } from "../events/events.service";
import { venueService } from "../venues/venues.service";
import { logger } from "../../lib/logger";
import { InstagramPost, ClassificationResult } from "./types";
import { Event } from "../events/types";
import { createConcurrencyLimit } from "../../lib/concurrency";

export class ScraperService {
  private PRIORITY_MAP = {
    dedicated_poster: 10,
    weekly_overview: 2,
    artist_promo: 1,
    not_event: 0
  };

  async run() {
    logger.info("Starting scraper run...");
    const today = new Date();
    const todayString = today.toISOString().split("T")[0];

    const venues = await venueService.getActiveVenues();
    if (venues.length === 0) {
      logger.warn("No active venues found. Aborting run.");
      return;
    }

    const igHandles = venues.map(v => v.ig_handle);
    const posts = await instagramClient.fetchPosts(igHandles);

    logger.info(`Fetched ${posts.length} total posts. Filtering by date...`);

    const thisWeekPosts = posts.filter(post => this.isFromThisWeek(post.timestamp, today));
    logger.info(`Processing ${thisWeekPosts.length} posts from this week.`);

    let totalGeminiCalls = 0;
    let geminiFailures = 0;
    let validationFailures = 0;
    let eventsInserted = 0;
    let eventsUpdated = 0;
    let eventsSkipped = 0;

    const concurrencyLimit = createConcurrencyLimit(Number(process.env.SCRAPER_CONCURRENCY) || 3);

    await Promise.all(thisWeekPosts.map(post => concurrencyLimit(async () => {
      try {
        const username = post.ownerUsername || "unknown";
        const imageSources = post.childPosts?.length ? post.childPosts : [post];
        const captionScore = classifier.getCaptionScore(post.caption);

        logger.info(`Processing @${username} | Caption score: ${captionScore} | Slides: ${imageSources.length}`);

        const slidesData: { events: Event[], buffer: Buffer, imageType: string, priority: number }[] = [];

        for (const source of imageSources) {
          const buffer = await imageService.getImageBuffer(source);
          if (!buffer) continue;

          let shouldRunAI = captionScore >= 2;
          if (!shouldRunAI) {
            const ocrText = await imageService.runOCR(buffer);
            shouldRunAI = classifier.isNightlifeKeyword(ocrText);
          }

          if (!shouldRunAI) {
            logger.debug(`Skipping slide: low score and no OCR signal`);
            continue;
          }

          totalGeminiCalls++;
          const result = await classifier.classifyImage(buffer, todayString);
          if (!result || !result.is_event) {
            if (!result) geminiFailures++;
            continue;
          }

          const priority = this.PRIORITY_MAP[result.image_type] || 0;
          if (priority === 0) continue;

          let extractedEvents: Event[] = [];
          if (result.image_type === "weekly_overview" && result.events) {
            extractedEvents = result.events.map(ev => ({
              event_name: ev.event_name || "Special Event",
              venue_id: username,
              event_date: ev.event_date,
              djs: ev.djs,
              source_priority: priority
            }));
          } else {
            extractedEvents = [{
              event_name: result.event_name || "Special Event",
              venue_id: username,
              event_date: result.event_date,
              djs: result.djs,
              source_priority: priority
            }];
          }

          // Filter out invalid dates
          const validEvents = extractedEvents.filter(ev => {
            const isValid = validator.validateDate(ev.event_date, today);
            if (!isValid) validationFailures++;
            return isValid;
          });

          if (validEvents.length > 0) {
            slidesData.push({
              events: validEvents,
              buffer,
              imageType: result.image_type,
              priority
            });
          }

          // Rate limit
          await new Promise(r => setTimeout(r, 1200));
        }

        const bestEvents = eventService.resolveCarouselBestEvents(slidesData);
        
        for (const date of Object.keys(bestEvents)) {
          const winner = bestEvents[date];
          const imageUrl = await imageService.uploadFlyer(winner.buffer, username);
          
          const result = await eventService.processWinningEvent({
            ...winner,
            image_url: imageUrl,
            ig_post_url: `${post.url}#${date}`
          });

          if (result === "inserted") eventsInserted++;
          else if (result === "updated") eventsUpdated++;
          else eventsSkipped++;
        }

      } catch (error) {
        logger.error(`Error processing post ${post.url}: ${error}`);
      }
    })));

    logger.info("Scraper run completed.");
    logger.info(`Summary:
      - Gemini calls: ${totalGeminiCalls}
      - Gemini failures: ${geminiFailures}
      - Validation failures: ${validationFailures}
      - Events inserted: ${eventsInserted}
      - Events updated: ${eventsUpdated}
      - Events skipped: ${eventsSkipped}`);

    if (totalGeminiCalls > 0 && validationFailures / totalGeminiCalls > 0.3) {
      logger.warn("WARN: prompt degradation suspected (validation failure rate > 30%)");
    }
  }

  private isFromThisWeek(dateString: string, now: Date): boolean {
    const postDate = new Date(dateString);
    const dayOfWeek = now.getDay();
    const lastSunday = new Date(now);
    lastSunday.setDate(now.getDate() - dayOfWeek);
    lastSunday.setHours(0, 0, 0, 0);
    return postDate >= lastSunday;
  }
}

export const scraperService = new ScraperService();
