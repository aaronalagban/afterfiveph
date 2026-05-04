import { supabase } from "../../lib/supabase";
import { Event } from "./types";
import { logger } from "../../lib/logger";

export class EventRepository {
  async findExistingEvent(venueId: string, eventDate: string): Promise<Event | null> {
    const { data, error } = await supabase
      .from("events")
      .select("id, source_priority")
      .eq("venue_id", venueId)
      .eq("event_date", eventDate)
      .maybeSingle();

    if (error) {
      logger.error(`Error looking up event: ${error.message}`);
      return null;
    }

    return data as Event;
  }

  async insertEvent(event: Event): Promise<void> {
    const { error } = await supabase.from("events").insert(event);
    if (error) {
      throw new Error(`Failed to insert event: ${error.message}`);
    }
  }

  async updateEvent(id: string | number, event: Partial<Event>): Promise<void> {
    const { error } = await supabase.from("events").update(event).eq("id", id);
    if (error) {
      throw new Error(`Failed to update event: ${error.message}`);
    }
  }
}

export const eventRepository = new EventRepository();
