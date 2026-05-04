export interface InstagramPost {
  ownerUsername: string;
  timestamp: string;
  caption?: string;
  type: "Image" | "Video" | "Sidecar";
  displayUrl?: string;
  videoUrl?: string;
  url: string;
  childPosts?: InstagramPost[];
}

export interface ClassificationResult {
  image_type: "dedicated_poster" | "weekly_overview" | "artist_promo" | "not_event";
  is_event: boolean;
  event_name: string;
  djs: string[];
  event_date: string;
  events?: { event_name: string; djs: string[]; event_date: string }[];
}
