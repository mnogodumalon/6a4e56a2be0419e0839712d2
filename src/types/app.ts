// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Objekte {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    bezeichnung?: string;
    strasse?: string;
    hausnummer?: string;
    postleitzahl?: string;
    stadt?: string;
    standort?: GeoLocation; // { lat, long, info }
    belegungsstatus?: LookupValue;
    notizen?: string;
  };
}

export interface Maengel {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    objekt?: string; // applookup -> URL zu 'Objekte' Record
    mangelbezeichnung?: string;
    beschreibung?: string;
    prioritaet?: LookupValue;
    status?: LookupValue;
    meldedatum?: string; // Format: YYYY-MM-DD oder ISO String
    zustaendige_person?: string;
    kontakt?: string;
    anhaenge?: string;
  };
}

export const APP_IDS = {
  OBJEKTE: '6a4e5573dde6bff982c5f8a6',
  MAENGEL: '6a4e55767e157cea183ea30a',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'objekte': {
    belegungsstatus: [{ key: "vermietet", label: "Vermietet" }, { key: "leer_stehend", label: "Leer stehend" }, { key: "in_renovierung", label: "In Renovierung" }],
  },
  'maengel': {
    prioritaet: [{ key: "mittel", label: "Mittel" }, { key: "hoch", label: "Hoch" }, { key: "dringend", label: "Dringend" }, { key: "niedrig", label: "Niedrig" }],
    status: [{ key: "offen", label: "Offen" }, { key: "in_bearbeitung", label: "In Bearbeitung" }, { key: "behoben", label: "Behoben" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'objekte': {
    'bezeichnung': 'string/text',
    'strasse': 'string/text',
    'hausnummer': 'string/text',
    'postleitzahl': 'string/text',
    'stadt': 'string/text',
    'standort': 'geo',
    'belegungsstatus': 'lookup/radio',
    'notizen': 'string/textarea',
  },
  'maengel': {
    'objekt': 'applookup/select',
    'mangelbezeichnung': 'string/text',
    'beschreibung': 'string/textarea',
    'prioritaet': 'lookup/radio',
    'status': 'lookup/radio',
    'meldedatum': 'date/date',
    'zustaendige_person': 'string/text',
    'kontakt': 'string/text',
    'anhaenge': 'file',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateObjekte = StripLookup<Objekte['fields']>;
export type CreateMaengel = StripLookup<Maengel['fields']>;