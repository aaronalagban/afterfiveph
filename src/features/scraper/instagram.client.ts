import { ApifyClient } from "apify-client";
import { retry } from "../../lib/retry";
import { InstagramPost } from "./types";
import { logger } from "../../lib/logger";

export class InstagramClient {
  private client: ApifyClient;

  constructor() {
    this.client = new ApifyClient({
      token: process.env.APIFY_API_TOKEN,
    });
  }

  async fetchPosts(usernames: string[], resultsLimit?: number): Promise<InstagramPost[]> {
    const limit = resultsLimit ?? Number(process.env.SCRAPER_RESULTS_LIMIT) || 12;
    return retry(async () => {
      logger.info(`Fetching posts for ${usernames.length} usernames with limit ${limit}`);
      
      const run = await this.client.actor("apify/instagram-profile-scraper").call({
        usernames,
        resultsType: "posts",
        resultsLimit: limit,
      });

      const { items } = await this.client.dataset(run.defaultDatasetId).listItems();

      const posts: InstagramPost[] = [];
      for (const item of items) {
        if ((item as any).latestPosts) {
          posts.push(...(item as any).latestPosts);
        }
      }

      return posts;
    }, 3, 1000);
  }
}

export const instagramClient = new InstagramClient();
