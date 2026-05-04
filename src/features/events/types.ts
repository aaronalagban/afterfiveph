export interface Event {
  id?: string | number;
  event_name: string;
  venue_id: string;
  event_date: string;
  djs: string[];
  image_url?: string;
  ig_post_url?: string;
  source_priority: number;
}

export interface BestEvent extends Event {
  buffer: Buffer;
  imageType: string;
}
