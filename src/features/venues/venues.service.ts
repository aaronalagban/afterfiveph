import { venueRepository } from "./venues.repository";
import { Venue } from "./types";

export class VenueService {
  async getActiveVenues(): Promise<Venue[]> {
    return venueRepository.getActiveVenues();
  }
}

export const venueService = new VenueService();
