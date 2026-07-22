export interface AdminPendingEvent {
  id: string;
  event_name: string | null;
  dj_name: string | null;
  club_name: string;
  city: string | null;
  event_date: string | null;
  image_url: string | null;
  ig_post_url: string;
  djs: string[] | null;
  carousel_images: string[] | null;
  source: string | null;
  status: string;
  created_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  confidence_score: number | null;
  raw_caption: string | null;
  ocr_text: string | null;
  scraper_notes: string | null;
  source_username: string | null;
  parse_method: string | null;
}

export interface AdminLiveEvent {
  id: string;
  event_name: string;
  dj_name: string | null;
  club_name: string;
  city: string;
  event_date: string;
  image_url: string | null;
  ig_post_url: string | null;
  djs: string[] | null;
  carousel_images: string[] | null;
  starts_at: string | null;
  ends_at: string | null;
  confidence_score: number | null;
  source_username: string | null;
  source: string | null;
}

export type CMSTab = 'review' | 'live' | 'cleanup' | 'stats' | 'reports';
export type ReviewSubTab = 'scraper' | 'users';

export type CMSState = {
  password: string;
  isAuth: boolean;
  activeTab: CMSTab;
  reviewSubTab: ReviewSubTab;
  scraperQueue: AdminPendingEvent[];
  userQueue: AdminPendingEvent[];
  liveEvents: AdminLiveEvent[];
  liveLoaded: boolean;
  expandedId: string | null;
  loading: Record<string, boolean>;
};

export type CMSAction =
  | { type: 'AUTH_SUCCESS'; password: string; events: AdminPendingEvent[] }
  | { type: 'LOAD_QUEUE'; events: AdminPendingEvent[] }
  | { type: 'LOAD_LIVE'; events: AdminLiveEvent[] }
  | { type: 'PROMOTE'; id: string }
  | { type: 'REJECT'; id: string }
  | { type: 'UPDATE_PENDING'; id: string; fields: Partial<AdminPendingEvent> }
  | { type: 'UPDATE_LIVE'; id: string; fields: Partial<AdminLiveEvent> }
  | { type: 'DELETE_PENDING'; id: string }
  | { type: 'DELETE_LIVE'; id: string }
  | { type: 'EXPAND'; id: string | null }
  | { type: 'SET_TAB'; tab: CMSTab }
  | { type: 'SET_REVIEW_SUB'; sub: ReviewSubTab }
  | { type: 'SET_LOADING'; key: string; value: boolean };

function splitQueue(events: AdminPendingEvent[]) {
  return {
    scraper: events.filter(e => e.source === 'scraper'),
    users:   events.filter(e => e.source !== 'scraper'),
  };
}

export function cmsReducer(state: CMSState, action: CMSAction): CMSState {
  switch (action.type) {
    case 'AUTH_SUCCESS': {
      const { scraper, users } = splitQueue(action.events);
      return { ...state, password: action.password, isAuth: true, scraperQueue: scraper, userQueue: users };
    }
    case 'LOAD_QUEUE': {
      const { scraper, users } = splitQueue(action.events);
      return { ...state, scraperQueue: scraper, userQueue: users };
    }
    case 'LOAD_LIVE':
      return { ...state, liveEvents: action.events, liveLoaded: true };
    case 'PROMOTE':
    case 'REJECT':
    case 'DELETE_PENDING':
      return {
        ...state,
        scraperQueue: state.scraperQueue.filter(e => e.id !== action.id),
        userQueue:    state.userQueue.filter(e => e.id !== action.id),
        expandedId:   state.expandedId === action.id ? null : state.expandedId,
      };
    case 'DELETE_LIVE':
      return { ...state, liveEvents: state.liveEvents.filter(e => e.id !== action.id) };
    case 'UPDATE_PENDING':
      return {
        ...state,
        scraperQueue: state.scraperQueue.map(e => e.id === action.id ? { ...e, ...action.fields } : e),
        userQueue:    state.userQueue.map(e => e.id === action.id ? { ...e, ...action.fields } : e),
      };
    case 'UPDATE_LIVE':
      return { ...state, liveEvents: state.liveEvents.map(e => e.id === action.id ? { ...e, ...action.fields } : e) };
    case 'EXPAND':
      return { ...state, expandedId: action.id };
    case 'SET_TAB':
      return { ...state, activeTab: action.tab, expandedId: null };
    case 'SET_REVIEW_SUB':
      return { ...state, reviewSubTab: action.sub, expandedId: null };
    case 'SET_LOADING':
      return { ...state, loading: { ...state.loading, [action.key]: action.value } };
    default:
      return state;
  }
}

export const initialCMSState: CMSState = {
  password: '',
  isAuth: false,
  activeTab: 'review',
  reviewSubTab: 'scraper',
  scraperQueue: [],
  userQueue: [],
  liveEvents: [],
  liveLoaded: false,
  expandedId: null,
  loading: {},
};
