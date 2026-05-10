export type ReportType = 'data_correction' | 'bug_report';
export type ReportStatus = 'pending' | 'approved' | 'rejected';

export interface UserReport {
  id: string;
  type: ReportType;
  status: ReportStatus;
  event_id: number | null;
  event_name: string | null;
  field_name: string | null;
  proposed_value: string | null;
  description: string | null;
  screenshot_urls: string[] | null;
  created_at: string;
  resolved_at: string | null;
}

export const CORRECTABLE_FIELDS: Record<string, string> = {
  event_name:  'Event Name',
  dj_name:     'DJ / Artist Name',
  club_name:   'Venue / Club',
  city:        'City',
  event_date:  'Event Date',
};
