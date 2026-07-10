import type { EnrichedMaengel } from '@/types/enriched';
import type { Maengel, Objekte } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface MaengelMaps {
  objekteMap: Map<string, Objekte>;
}

export function enrichMaengel(
  maengel: Maengel[],
  maps: MaengelMaps
): EnrichedMaengel[] {
  return maengel.map(r => ({
    ...r,
    objektName: resolveDisplay(r.fields.objekt, maps.objekteMap, 'bezeichnung'),
  }));
}
