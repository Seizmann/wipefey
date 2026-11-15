import type { ReactNode } from 'react'
import type {
  ImageMetadata,
  MetadataCategory,
  PngTextChunk,
} from '../lib/metadata/unified'
import type { BatchFile } from '../lib/batch/types'
import { MarkersView } from './MarkersView'

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'string') return v
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(6)
  if (typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return v.map(formatValue).join(', ')
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function Row({ k, v }: { k: string; v: unknown }) {
  return (
    <div className="grid grid-cols-[minmax(9rem,1fr)_2fr] gap-3 py-1.5 font-mono text-xs">
      <dt className="truncate text-faint" title={k}>
        {k}
      </dt>
      <dd className="min-w-0 break-words text-foreground" title={formatValue(v)}>
        {formatValue(v)}
      </dd>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="rounded-wsm border border-border bg-surface">
      <h4 className="border-b border-border px-4 py-2 font-mono text-xs text-muted">
        {title}
      </h4>
      <dl className="divide-y divide-border/60 px-4 py-2">{children}</dl>
    </section>
  )
}

function ObjectRows({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data)
  if (entries.length === 0) {
    return <p className="py-2 font-mono text-xs text-faint">(none found)</p>
  }
  return (
    <>
      {entries.map(([k, v]) => (
        <Row key={k} k={k} v={v} />
      ))}
    </>
  )
}

function PngChunksSection({ chunks }: { chunks: PngTextChunk[] }) {
  if (chunks.length === 0) {
    return <p className="py-2 font-mono text-xs text-faint">(no text chunks)</p>
  }
  return (
    <>
      {chunks.map((c, i) => (
        <div key={i} className="flex flex-col gap-1 py-2">
          <dt className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <span className="text-faint">{c.type}</span>
            <span className="text-foreground">{c.key || '(empty key)'}</span>
            {c.compressed && (
              <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted">
                zlib
              </span>
            )}
            {c.failed && (
              <span className="text-ai">decode failed</span>
            )}
          </dt>
          <dd className="whitespace-pre-wrap break-words rounded-wxs bg-surface-2 px-2.5 py-1.5 font-mono text-xs text-foreground">
            {c.failed ? '(could not decode)' : c.value || '(empty value)'}
          </dd>
        </div>
      ))}
    </>
  )
}

/** Which sections to render, derived from the metadata fields present. */
function categories(meta: ImageMetadata): { id: MetadataCategory; el: ReactNode }[] {
  const els: { id: MetadataCategory; el: ReactNode }[] = []

  if (meta.camera && (meta.camera.make || meta.camera.model || meta.camera.software)) {
    els.push({
      id: 'Camera',
      el: (
        <>
          <Row k="Make" v={meta.camera.make} />
          <Row k="Model" v={meta.camera.model} />
          <Row k="Software" v={meta.camera.software} />
        </>
      ),
    })
  }

  if (meta.dates && (meta.dates.taken || meta.dates.digitized || meta.dates.modified)) {
    els.push({
      id: 'Dates',
      el: (
        <>
          <Row k="Taken" v={meta.dates.taken} />
          <Row k="Digitized" v={meta.dates.digitized} />
          <Row k="Modified" v={meta.dates.modified} />
        </>
      ),
    })
  }

  if (meta.gps) {
    els.push({
      id: 'GPS',
      el: (
        <>
          <Row k="Latitude" v={meta.gps.latitude} />
          <Row k="Longitude" v={meta.gps.longitude} />
          <Row k="Altitude" v={meta.gps.altitude} />
        </>
      ),
    })
  }

  if (meta.exif && Object.keys(meta.exif).length > 0) {
    els.push({ id: 'EXIF', el: <ObjectRows data={meta.exif} /> })
  }

  if (meta.iptc && Object.keys(meta.iptc).length > 0) {
    els.push({ id: 'IPTC', el: <ObjectRows data={meta.iptc as Record<string, unknown>} /> })
  }

  if (meta.xmp && Object.keys(meta.xmp).length > 0) {
    els.push({ id: 'XMP', el: <ObjectRows data={meta.xmp} /> })
  }

  if (meta.icc && Object.keys(meta.icc).length > 0) {
    els.push({ id: 'ICC', el: <ObjectRows data={meta.icc as Record<string, unknown>} /> })
  }

  if (meta.pngChunks && meta.pngChunks.length > 0) {
    els.push({ id: 'PNG text chunks', el: <PngChunksSection chunks={meta.pngChunks} /> })
  }

  if (meta.c2pa || meta.digitalSourceType) {
    els.push({
      id: 'C2PA',
      el: (
        <>
          {meta.c2pa && (
            <>
              <Row k="Carrier" v={meta.c2pa.containerLabel} />
              <Row k="Creation tool" v={meta.c2pa.creationTool ?? '—'} />
              {meta.c2pa.modelHint && (
                <Row k="Model hint" v={meta.c2pa.modelHint} />
              )}
              {meta.c2pa.fields
                .filter((f) => f.key !== 'claim_generator' && f.key !== 'softwareAgent')
                .map((f) => (
                  <Row key={f.key} k={f.key} v={f.value} />
                ))}
            </>
          )}
          {meta.digitalSourceType && (
            <Row k="IPTC DigitalSourceType" v={meta.digitalSourceType} />
          )}
        </>
      ),
    })
  }

  return els
}

interface Props {
  file: BatchFile
}

/**
 * Raw, complete metadata display for one analyzed file — organized by
 * category. Shows everything extracted; not a curated subset. No AI-marker
 * interpretation here (that is Phase 2).
 */
export function MetadataPanel({ file }: Props) {
  const meta = file.metadata

  if (!meta) {
    return (
      <div className="rounded-wsm border border-border bg-surface p-6 text-center">
        <p className="font-mono text-sm text-muted">
          {file.status === 'error'
            ? 'Analysis failed for this file.'
            : 'Select an analyzed file to see its metadata.'}
        </p>
        {file.error && <p className="mt-2 text-xs text-ai">{file.error}</p>}
      </div>
    )
  }

  const sections = categories(meta)

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="min-w-0 flex items-center justify-between gap-2">
        <h3 className="min-w-0 truncate font-mono text-sm text-foreground" title={file.file.name}>{file.file.name}</h3>
        <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[11px] text-muted">
          {meta.format}
        </span>
      </div>

      {meta.warning && (
        <p className="rounded-wxs border border-unsure/30 bg-surface p-3 text-xs text-unsure">
          {meta.warning}
        </p>
      )}

      {meta.width && meta.height ? (
        <p className="font-mono text-xs text-faint">
          {meta.width} × {meta.height}px
        </p>
      ) : null}

      {/* ── AI-generation heuristic (Phase 2) ── */}
      <MarkersView metadata={meta} />

      {/* ── Raw metadata categories ── */}
      {sections.length === 0 ? (
        <p className="rounded-wsm border border-border bg-surface p-5 font-mono text-xs text-muted">
          No readable metadata found in this file.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {sections.map((s) => (
            <Section key={s.id} title={s.id}>
              {s.el}
            </Section>
          ))}
        </div>
      )}
    </div>
  )
}
