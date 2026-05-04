import fs from "fs";
import { execSync } from "child_process";
import { InstagramPost } from "./types";
import { logger } from "../../lib/logger";
import { supabase } from "../../lib/supabase";
import Tesseract from "tesseract.js";

export class ImageService {
  async getImageBuffer(post: InstagramPost): Promise<Buffer | null> {
    const isVideo = post.type === "Video" || !!post.videoUrl;

    if (post.displayUrl) {
      try {
        const res = await fetch(post.displayUrl);
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length > 5000) return buffer;
      } catch (error) {
        logger.debug(`Thumbnail fetch failed for ${post.url}: ${error}`);
      }
    }

    if (isVideo && post.videoUrl) {
      try {
        const tmpVideo = `/tmp/vid-${Date.now()}.mp4`;
        const tmpFrame = `/tmp/frame-${Date.now()}.jpg`;

        const res = await fetch(post.videoUrl);
        fs.writeFileSync(tmpVideo, Buffer.from(await res.arrayBuffer()));

        execSync(`ffmpeg -ss 2 -i ${tmpVideo} -frames:v 1 ${tmpFrame} -y -loglevel error`);

        const buffer = fs.readFileSync(tmpFrame);

        fs.unlinkSync(tmpVideo);
        fs.unlinkSync(tmpFrame);

        if (buffer.length > 5000) return buffer;
      } catch (error) {
        logger.debug(`ffmpeg frame extraction failed for ${post.url}: ${error}`);
      }
    }

    return null;
  }

  async runOCR(buffer: Buffer): Promise<string> {
    try {
      const { data: { text } } = await Tesseract.recognize(buffer, "eng", { logger: () => {} });
      return text.toLowerCase();
    } catch (error) {
      logger.error(`OCR failed: ${error}`);
      return "";
    }
  }

  async uploadFlyer(buffer: Buffer, username: string): Promise<string> {
    const fileName = `flyer-${username}-${Date.now()}.jpg`;

    const { error } = await supabase.storage
      .from("event-flyers")
      .upload(fileName, buffer, {
        contentType: "image/jpeg",
        upsert: true
      });

    if (error) {
      throw new Error(`Failed to upload flyer: ${error.message}`);
    }

    const { data: { publicUrl } } = supabase.storage.from("event-flyers").getPublicUrl(fileName);
    return publicUrl;
  }
}

export const imageService = new ImageService();
