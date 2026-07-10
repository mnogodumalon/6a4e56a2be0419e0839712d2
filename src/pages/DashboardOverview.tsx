import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichMaengel } from '@/lib/enrich';
import type { Objekte, Maengel } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDate, lookupKey } from '@/lib/formatters';
import { useState, useMemo, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { IconAlertCircle, IconTool, IconRefresh, IconCheck, IconBuildingEstate, IconAlertTriangle, IconCircleCheck } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { StatCardRow, StatCard } from '@/components/StatCard';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { reverseGeocodeDetailed } from '@/lib/ai';
import {
  MapWidget,
  MapSkeleton,
  MapError,
  MapRouteLinks,
  type MapMarker,
  type MapTone,
} from '@/components/widgets/MapWidget';
import {
  RecordOverlay,
  RecordHeader,
  useRecordOverlayStack,
} from '@/components/widgets/RecordView';
import { ObjekteDetails } from '@/components/details/ObjekteDetails';
import { MaengelDetails } from '@/components/details/MaengelDetails';
import { ObjekteDialog } from '@/components/dialogs/ObjekteDialog';
import { MaengelDialog } from '@/components/dialogs/MaengelDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';

type OverlayItem =
  | { type: 'objekt'; id: string }
  | { type: 'mangel'; id: string };

const APPGROUP_ID = '6a4e56a2be0419e0839712d2';
const REPAIR_ENDPOINT = '/claude/build/repair';

function statusTone(key: string | undefined): MapTone {
  if (key === 'vermietet') return 'success';
  if (key === 'in_renovierung') return 'warning';
  if (key === 'leer_stehend') return 'destructive';
  return 'default';
}

export default function DashboardOverview() {
  const {
    objekte, setObjekte,
    maengel, setMaengel,
    objekteMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedMaengel = enrichMaengel(maengel, { objekteMap });

  const clock = useClock();
  const overlay = useRecordOverlayStack<OverlayItem>();

  // Dialog state
  const [objekteDialogOpen, setObjekteDialogOpen] = useState(false);
  const [editingObjekt, setEditingObjekt] = useState<Objekte | null>(null);
  const [maengelDialogOpen, setMaengelDialogOpen] = useState(false);
  const [editingMangel, setEditingMangel] = useState<Maengel | null>(null);
  const [newMangelObjektId, setNewMangelObjektId] = useState<string | undefined>(undefined);

  // Tap-to-create draft for the map
  const [createDraft, setCreateDraft] = useState<{ lat: number; long: number; info?: string; strasse?: string; hausnummer?: string; postleitzahl?: string; stadt?: string } | null>(null);

  // Filter state — for KPI interaction
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Computed values — all BEFORE early returns
  const offeneMaengel = useMemo(
    () => enrichedMaengel.filter(m => lookupKey(m.fields.status) === 'offen'),
    [enrichedMaengel]
  );
  const dringendeMaengel = useMemo(
    () => enrichedMaengel.filter(m => lookupKey(m.fields.prioritaet) === 'dringend'),
    [enrichedMaengel]
  );
  const leerstehendeObjekte = useMemo(
    () => objekte.filter(o => lookupKey(o.fields.belegungsstatus) === 'leer_stehend'),
    [objekte]
  );
  const renovierungObjekte = useMemo(
    () => objekte.filter(o => lookupKey(o.fields.belegungsstatus) === 'in_renovierung'),
    [objekte]
  );

  const filteredObjekte = useMemo(() => {
    if (!statusFilter) return objekte;
    return objekte.filter(o => lookupKey(o.fields.belegungsstatus) === statusFilter);
  }, [objekte, statusFilter]);

  // Map markers
  const markers = useMemo<MapMarker[]>(() => {
    return filteredObjekte.flatMap(o => {
      const geo = o.fields.standort;
      if (!geo) return [];
      const mangelCount = enrichedMaengel.filter(m => extractRecordId(m.fields.objekt) === o.record_id && lookupKey(m.fields.status) !== 'behoben').length;
      return [{
        id: `objekt:${o.record_id}`,
        lat: geo.lat,
        long: geo.long,
        title: o.fields.bezeichnung ?? 'Unbenannt',
        subtitle: mangelCount > 0
          ? `${mangelCount} offene Mängel`
          : (o.fields.belegungsstatus?.label ?? geo.info ?? ''),
        tone: statusTone(lookupKey(o.fields.belegungsstatus)),
        icon: 'building' as const,
      }];
    });
  }, [filteredObjekte, enrichedMaengel]);

  // Aside: dringende Mängel across all objects
  const dringendeOffen = useMemo(
    () => dringendeMaengel.filter(m => lookupKey(m.fields.status) !== 'behoben')
      .sort((a, b) => (a.fields.meldedatum ?? '').localeCompare(b.fields.meldedatum ?? '')),
    [dringendeMaengel]
  );

  // Status advance helper for Mängel
  const advanceMangel = useCallback(async (m: Maengel) => {
    const currentStatus = lookupKey(m.fields.status);
    const nextStatus = currentStatus === 'offen' ? 'in_bearbeitung' : currentStatus === 'in_bearbeitung' ? 'behoben' : null;
    if (!nextStatus) return;
    const prevStatus = currentStatus;
    // Optimistic update
    setMaengel(prev => prev.map(x => x.record_id === m.record_id
      ? { ...x, fields: { ...x.fields, status: LOOKUP_OPTIONS['maengel']?.['status']?.find(s => s.key === nextStatus) ?? { key: nextStatus, label: nextStatus } } }
      : x
    ));
    const label = nextStatus === 'in_bearbeitung' ? 'In Bearbeitung' : 'Behoben';
    undoToast(`Mangel als „${label}" markiert`, async () => {
      setMaengel(prev => prev.map(x => x.record_id === m.record_id
        ? { ...x, fields: { ...x.fields, status: { key: prevStatus ?? 'offen', label: prevStatus === 'in_bearbeitung' ? 'In Bearbeitung' : 'Offen' } } }
        : x
      ));
      try { await LivingAppsService.updateMaengelEntry(m.record_id, { status: prevStatus ?? 'offen' }); } catch { fetchAll(); }
    });
    try {
      await LivingAppsService.updateMaengelEntry(m.record_id, { status: nextStatus });
    } catch {
      fetchAll();
    }
  }, [setMaengel, fetchAll]);

  const nextStatusLabel = (m: Maengel) => {
    const s = lookupKey(m.fields.status);
    if (s === 'offen') return 'In Bearbeitung';
    if (s === 'in_bearbeitung') return '✓ Behoben';
    return null;
  };

  // Hero: dringende offene Mängel
  const dringendeOffeneMaengel = useMemo(
    () => dringendeOffen.filter(m => lookupKey(m.fields.status) === 'offen'),
    [dringendeOffen]
  );

  // Resolve overlayed record
  const currentObjekt = overlay.top?.type === 'objekt' ? objekte.find(o => o.record_id === overlay.top!.id) : undefined;
  const currentMangel = overlay.top?.type === 'mangel' ? maengel.find(m => m.record_id === overlay.top!.id) : undefined;

  // Hooks ABOVE early returns ✓

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  const contextLine = objekte.length === 0
    ? 'Noch keine Objekte erfasst — leg jetzt dein erstes an.'
    : offeneMaengel.length > 0
      ? `${offeneMaengel.length} offene Mängel in ${new Set(offeneMaengel.map(m => extractRecordId(m.fields.objekt))).size} Objekten.`
      : `Alle ${objekte.length} Objekte im Blick — keine offenen Mängel.`;

  return (
    <>
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{gruss(clock)}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{contextLine}</p>
        </div>
        <Button onClick={() => { setEditingObjekt(null); setObjekteDialogOpen(true); }}>
          <IconBuildingEstate size={16} className="mr-1.5 shrink-0" />
          Objekt anlegen
        </Button>
      </div>

      <DashboardGrid
        variant="split"
        hero={
          dringendeOffeneMaengel.length > 0 ? (
            <HeroBanner
              icon={<IconAlertTriangle size={18} />}
              tone="destructive"
              action={{
                label: 'In Bearbeitung setzen',
                onClick: () => advanceMangel(dringendeOffeneMaengel[0]),
              }}
            >
              <b>{namen(dringendeOffeneMaengel.map(m => m.fields.mangelbezeichnung ?? 'Mangel'))}</b>
              {' '}— dringende{dringendeOffeneMaengel.length > 1 ? ' Mängel' : 'r Mangel'} in{' '}
              {namen(dringendeOffeneMaengel.map(m => m.objektName ?? ''), 2)} sofort handeln.
            </HeroBanner>
          ) : null
        }
        kpis={
          <StatCardRow>
            <StatCard
              title="Vermietet"
              value={objekte.filter(o => lookupKey(o.fields.belegungsstatus) === 'vermietet').length}
              description={statusFilter === 'vermietet' ? 'Filter aktiv' : 'Auf Karte anzeigen'}
              icon={<IconCircleCheck size={18} className="text-muted-foreground" />}
              tone={statusFilter === 'vermietet' ? 'success' : 'default'}
              onClick={() => setStatusFilter(f => f === 'vermietet' ? null : 'vermietet')}
              active={statusFilter === 'vermietet'}
            />
            <StatCard
              title="Leer stehend"
              value={leerstehendeObjekte.length}
              description={leerstehendeObjekte.length > 0 ? 'Handlungsbedarf' : 'Alles vermietet'}
              icon={<IconBuildingEstate size={18} className="text-muted-foreground" />}
              tone={leerstehendeObjekte.length > 0 ? 'warning' : 'default'}
              onClick={() => setStatusFilter(f => f === 'leer_stehend' ? null : 'leer_stehend')}
              active={statusFilter === 'leer_stehend'}
            />
            <StatCard
              title="In Renovierung"
              value={renovierungObjekte.length}
              description={renovierungObjekte.length > 0 ? 'Aktive Baustellen' : 'Keine Baustellen'}
              icon={<IconTool size={18} className="text-muted-foreground" />}
              tone={renovierungObjekte.length > 0 ? 'primary' : 'default'}
              onClick={() => setStatusFilter(f => f === 'in_renovierung' ? null : 'in_renovierung')}
              active={statusFilter === 'in_renovierung'}
            />
            <StatCard
              title="Offene Mängel"
              value={offeneMaengel.length}
              description={offeneMaengel.length > 0 ? 'Reparaturen ausstehend' : 'Alles in Ordnung'}
              icon={<IconAlertCircle size={18} className="text-muted-foreground" />}
              tone={offeneMaengel.length > 0 ? 'destructive' : 'default'}
            />
          </StatCardRow>
        }
        aside={
          <>
            <WorkList
              title="Dringende Mängel"
              icon={<IconAlertTriangle size={16} className="shrink-0" />}
              items={dringendeOffen.slice(0, 8).map(m => ({
                id: m.record_id,
                title: m.fields.mangelbezeichnung ?? 'Unbekannter Mangel',
                secondLine: (
                  <>
                    <span className={lookupKey(m.fields.status) === 'offen' ? 'font-medium text-destructive' : 'font-medium text-amber-600'}>
                      {m.fields.status?.label ?? '—'}
                    </span>
                    <span className="text-muted-foreground"> · {m.objektName || '—'}</span>
                    {m.fields.meldedatum && (
                      <span className="text-muted-foreground"> · {formatDate(m.fields.meldedatum)}</span>
                    )}
                  </>
                ),
                action: nextStatusLabel(m) ? {
                  label: nextStatusLabel(m)!,
                  onClick: () => advanceMangel(m),
                } : undefined,
              }))}
              onItemClick={id => overlay.replace({ type: 'mangel', id })}
              empty={{
                text: 'Keine dringenden Mängel — alles unter Kontrolle.',
                action: {
                  label: 'Mangel melden',
                  onClick: () => { setEditingMangel(null); setNewMangelObjektId(undefined); setMaengelDialogOpen(true); },
                },
              }}
            />
            <WorkList
              title="Alle offenen Mängel"
              items={offeneMaengel.slice(0, 5).map(m => ({
                id: m.record_id,
                title: m.fields.mangelbezeichnung ?? 'Unbekannter Mangel',
                secondLine: (
                  <>
                    <span className="font-medium text-amber-600">{m.fields.prioritaet?.label ?? '—'}</span>
                    <span className="text-muted-foreground"> · {m.objektName || '—'}</span>
                  </>
                ),
                action: {
                  label: 'Bearbeiten',
                  onClick: () => advanceMangel(m),
                },
              }))}
              onItemClick={id => overlay.replace({ type: 'mangel', id })}
              empty={{
                text: 'Keine offenen Mängel — alles behoben.',
                action: {
                  label: 'Mangel melden',
                  onClick: () => { setEditingMangel(null); setNewMangelObjektId(undefined); setMaengelDialogOpen(true); },
                },
              }}
            />
          </>
        }
        primary={
          <MapWidget
            markers={markers}
            legend={[
              { label: 'Vermietet', tone: 'success', icon: 'building' },
              { label: 'Leer stehend', tone: 'destructive', icon: 'building' },
              { label: 'In Renovierung', tone: 'warning', icon: 'building' },
            ]}
            onMarkerClick={marker => {
              const id = marker.id.split(':')[1] ?? '';
              overlay.replace({ type: 'objekt', id });
            }}
            onMapPointClick={async ({ lat, long }) => {
              const addr = await reverseGeocodeDetailed(lat, long);
              setCreateDraft({
                lat,
                long,
                info: addr.display,
                strasse: addr.road,
                hausnummer: addr.houseNumber,
                postleitzahl: addr.postcode,
                stadt: addr.city,
              });
              setEditingObjekt(null);
              setObjekteDialogOpen(true);
            }}
          />
        }
      />

      {/* Record Overlay — one shell for both entity types */}
      <RecordOverlay
        open={overlay.open}
        onClose={overlay.close}
        onBack={overlay.canGoBack ? overlay.pop : undefined}
        onEdit={
          overlay.top?.type === 'objekt'
            ? () => { const o = objekte.find(x => x.record_id === overlay.top!.id); if (o) { setEditingObjekt(o); setObjekteDialogOpen(true); } }
            : overlay.top?.type === 'mangel'
              ? () => { const m = maengel.find(x => x.record_id === overlay.top!.id); if (m) { setEditingMangel(m); setMaengelDialogOpen(true); } }
              : undefined
        }
        ariaLabel={overlay.top?.type === 'objekt' ? 'Objekt-Details' : 'Mangel-Details'}
        footer={
          overlay.top?.type === 'mangel' && currentMangel
            ? nextStatusLabel(currentMangel)
              ? (
                <Button size="sm" onClick={() => advanceMangel(currentMangel)}>
                  {nextStatusLabel(currentMangel)}
                </Button>
              )
              : undefined
            : undefined
        }
      >
        {overlay.top?.type === 'objekt' && currentObjekt && (
          <>
            <RecordHeader
              title={currentObjekt.fields.bezeichnung ?? 'Objekt'}
              subtitle={[currentObjekt.fields.strasse, currentObjekt.fields.hausnummer].filter(Boolean).join(' ') || currentObjekt.fields.stadt}
              badges={
                currentObjekt.fields.belegungsstatus ? (
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground">
                    {currentObjekt.fields.belegungsstatus.label}
                  </span>
                ) : undefined
              }
            />
            <ObjekteDetails
              record={currentObjekt}
              maengelList={maengel}
              onOpenMaengel={m => overlay.push({ type: 'mangel', id: m.record_id })}
              onAddMaengel={() => {
                setNewMangelObjektId(currentObjekt.record_id);
                setEditingMangel(null);
                setMaengelDialogOpen(true);
              }}
            />
            {currentObjekt.fields.standort && (
              <div className="px-6 pb-4">
                <MapRouteLinks lat={currentObjekt.fields.standort.lat} long={currentObjekt.fields.standort.long} />
              </div>
            )}
          </>
        )}
        {overlay.top?.type === 'mangel' && currentMangel && (
          <>
            <RecordHeader
              title={currentMangel.fields.mangelbezeichnung ?? 'Mangel'}
              subtitle={currentMangel.fields.status?.label}
              badges={
                currentMangel.fields.prioritaet ? (
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-destructive/10 text-destructive">
                    {currentMangel.fields.prioritaet.label}
                  </span>
                ) : undefined
              }
            />
            <MaengelDetails
              record={currentMangel}
              objekteList={objekte}
              onOpenObjekte={o => overlay.push({ type: 'objekt', id: o.record_id })}
            />
          </>
        )}
      </RecordOverlay>

      {/* Objekte Dialog */}
      <ObjekteDialog
        open={objekteDialogOpen}
        onClose={() => { setObjekteDialogOpen(false); setEditingObjekt(null); setCreateDraft(null); }}
        onSubmit={async (fields) => {
          if (editingObjekt) {
            await LivingAppsService.updateObjekteEntry(editingObjekt.record_id, fields);
          } else {
            await LivingAppsService.createObjekteEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={
          editingObjekt
            ? editingObjekt.fields
            : createDraft
              ? {
                  standort: { lat: createDraft.lat, long: createDraft.long, info: createDraft.info },
                  strasse: createDraft.strasse,
                  hausnummer: createDraft.hausnummer,
                  postleitzahl: createDraft.postleitzahl,
                  stadt: createDraft.stadt,
                }
              : undefined
        }
        recordId={editingObjekt?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Objekte']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Objekte']}
      />

      {/* Mängel Dialog */}
      <MaengelDialog
        open={maengelDialogOpen}
        onClose={() => { setMaengelDialogOpen(false); setEditingMangel(null); setNewMangelObjektId(undefined); }}
        onSubmit={async (fields) => {
          if (editingMangel) {
            await LivingAppsService.updateMaengelEntry(editingMangel.record_id, fields);
          } else {
            await LivingAppsService.createMaengelEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={
          editingMangel
            ? editingMangel.fields
            : newMangelObjektId
              ? { objekt: createRecordUrl(APP_IDS.OBJEKTE, newMangelObjektId) }
              : undefined
        }
        recordId={editingMangel?.record_id}
        objekteList={objekte}
        enablePhotoScan={AI_PHOTO_SCAN['Maengel']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Maengel']}
      />
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) {
            setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          }
          if (content.startsWith('[DONE]')) {
            setRepairDone(true);
            setRepairing(false);
          }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) {
            setRepairFailed(true);
          }
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte laden Sie die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktieren Sie den Support.</p>}
    </div>
  );
}
