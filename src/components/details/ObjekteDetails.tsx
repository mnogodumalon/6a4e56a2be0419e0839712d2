import type { Objekte, Maengel } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface ObjekteDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Objekte;
  /** 1:N „Mängel": VOLLE Liste — der Block filtert auf diesen Record. */
  maengelList: Maengel[];
  /** Zeilen-Klick → overlay.push auf das Maengel-Detail (nie der Edit-Dialog). */
  onOpenMaengel: (record: Maengel) => void;
  /** Kontextuelles „+": öffnet den Maengel-Dialog mit diesem Record vorgesetzt. */
  onAddMaengel: () => void;
}

export function ObjekteDetails({
  record,
  maengelList,
  onOpenMaengel,
  onAddMaengel,
}: ObjekteDetailsProps) {
  return (
    <>
      <RecordSection title="Details" cols={2}>
        <RecordField label="Objektbezeichnung" value={record.fields.bezeichnung} format="text" />
        <RecordField label="Straße" value={record.fields.strasse} format="text" />
        <RecordField label="Hausnummer" value={record.fields.hausnummer} format="text" />
        <RecordField label="Postleitzahl" value={record.fields.postleitzahl} format="text" />
        <RecordField label="Stadt" value={record.fields.stadt} format="text" />
        <RecordField label="Standort" value={record.fields.standort?.info ?? (record.fields.standort ? `${record.fields.standort.lat}, ${record.fields.standort.long}` : null)} />
        <RecordField label="Belegungsstatus" value={record.fields.belegungsstatus} format="pill" />
        <RecordField label="Notizen" value={record.fields.notizen} format="longtext" className="md:col-span-2" />
      </RecordSection>

      <SatelliteSection
        title="Mängel"
        items={maengelList.filter(r => extractRecordId(r.fields.objekt) === record.record_id)}
        map={r => ({ name: r.fields.mangelbezeichnung ?? 'Mängel', meta: r.fields.meldedatum })}
        onOpen={onOpenMaengel}
        onAdd={onAddMaengel}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.OBJEKTE} recordId={record.record_id} />
    </>
  );
}
