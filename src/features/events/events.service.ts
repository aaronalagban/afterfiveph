import { eventRepository } from "./events.repository";
import { Event, BestEvent } from "./types";
import { logger } from "../../lib/logger";

export class EventService {
  async processWinningEvent(event: Event): Promise<"inserted" | "updated" | "skipped"> {
    const existing = await eventRepository.findExistingEvent(event.venue_id, event.event_date);

    if (existing) {
      const existingPriority = existing.source_priority ?? 0;

      if (event.source_priority > existingPriority) {
        await eventRepository.updateEvent(existing.id!, event);
        return "updated";
      } else {
        return "skipped";
      }
    } else {
      await eventRepository.insertEvent(event);
      return "inserted";
    }
  }

  resolveCarouselBestEvents(slidesData: { events: Event[], buffer: Buffer, imageType: string, priority: number }[]): Record<string, BestEvent> {
    const bestEvents: Record<string, BestEvent> = {};

    for (const slide of slidesData) {
      for (const ev of slide.events) {
        const existing = bestEvents[ev.event_date];

        if (!existing || slide.priority > existing.source_priority) {
          bestEvents[ev.event_date] = {
            ...ev,
            buffer: slide.buffer,
            imageType: slide.imageType,
            source_priority: slide.priority
          };
        }
      }
    }

    return bestEvents;
  }
}

export const eventService = new EventService();
