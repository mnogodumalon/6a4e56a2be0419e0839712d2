import type { Maengel, Objekte } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { MediaThumbnail } from '@/components/widgets/MediaViewer';

export interface MaengelDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Maengel;
  /** N:1-Ziel „Objekte": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  objekteList: Objekte[];
  /** Klick auf die Objekte-Relation → overlay.push auf dessen Detail. */
  onOpenObjekte?: (record: Objekte) => void;
}

export function MaengelDetails({
  record,
  objekteList,
  onOpenObjekte,
}: MaengelDetailsProps) {
  const objektTarget = objekteList.find(r => r.record_id === extractRecordId(record.fields.objekt));
  return (
    <>
      <RecordSection title="Details" cols={2}>
        <RecordField label="Mangelbezeichnung" value={record.fields.mangelbezeichnung} format="text" />
        <RecordField label="Beschreibung" value={record.fields.beschreibung} format="longtext" className="md:col-span-2" />
        <RecordField label="Priorität" value={record.fields.prioritaet} format="pill" />
        <RecordField label="Status" value={record.fields.status} format="pill" />
        <RecordField label="Meldedatum" value={record.fields.meldedatum} format="date" />
        <RecordField label="Zuständige Person" value={record.fields.zustaendige_person} format="text" />
        <RecordField label="Kontakt (Telefon oder E-Mail)" value={record.fields.kontakt} format="text" />
        <RecordField label="Fotos / Dokumente" className="md:col-span-2">
          {record.fields.anhaenge ? (
            <MediaThumbnail src={record.fields.anhaenge as string} fit="contain" className="max-h-64 w-full rounded-lg" />
          ) : '—'}
        </RecordField>
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title="Verknüpft" cols={1}>
        <RecordRelation
          label="Objekt"
          name={objektTarget?.fields.bezeichnung ?? '—'}
          meta={[objektTarget?.fields.strasse, objektTarget?.fields.hausnummer].filter(Boolean).join(' · ') || undefined}
          onClick={objektTarget && onOpenObjekte ? () => onOpenObjekte!(objektTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.MAENGEL} recordId={record.record_id} />
    </>
  );
}
