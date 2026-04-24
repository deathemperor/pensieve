export type TierCode = "S" | "A" | "B" | "C" | "D";

export type ChannelKind =
  | "email"
  | "phone"
  | "telegram"
  | "signal"
  | "whatsapp"
  | "linkedin"
  | "twitter"
  | "x"
  | "facebook"
  | "wechat"
  | "zalo"
  | "url";

export type ContactSource =
  | "manual"
  | "ios"
  | "google"
  | "facebook"
  | "linkedin"
  | "card"
  | "openclaw"
  | "shortcut";

export interface Channel {
  id: string;
  contact_id: string;
  kind: ChannelKind;
  value: string;
  label: string | null;
  is_primary: number;  // 0 or 1
  created_at: string;
}

export interface Contact {
  id: string;
  full_name: string;
  display_name: string | null;
  title: string | null;
  company: string | null;
  company_domain: string | null;
  photo_key: string | null;
  prestige_tier: TierCode;
  tier_score: number;
  location: string | null;
  bio: string | null;
  source: ContactSource;
  external_ids: string | null;  // JSON string
  tags: string | null;           // JSON string
  birthday: string | null;
  is_placeholder: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactWithChannels extends Contact {
  channels: Channel[];
}

export interface ListContactsOptions {
  includePlaceholders: boolean;
  onlyPlaceholders: boolean;
  search?: string;
  tiers?: TierCode[];
}

export interface CreateContactInput {
  full_name: string;
  display_name?: string | null;
  title?: string | null;
  company?: string | null;
  company_domain?: string | null;
  prestige_tier: TierCode;
  tier_score?: number;
  location?: string | null;
  bio?: string | null;
  source?: ContactSource;
  tags?: string[];
  channels?: Array<{
    kind: ChannelKind;
    value: string;
    label?: string;
    is_primary?: boolean;
  }>;
}
