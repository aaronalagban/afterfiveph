import { supabase } from "../../lib/supabase";
import { Venue } from "./types";

export class VenueRepository {
  async getActiveVenues(): Promise<Venue[]> {
    const { data, error } = await supabase
      .from("venues")
      .select("*")
      .eq("is_active", true);

    if (error) {
      throw new Error(`Failed to fetch active venues: ${error.message}`);
    }

    return data as Venue[];
  }
}

export const venueRepository = new VenueRepository();
