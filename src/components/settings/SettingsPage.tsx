import { useEffect, useRef, useState } from 'react';
import { en } from '@/i18n/en';
import { format } from '@/i18n/format';
import { brand } from '@/config/brand';
import { backupSchema, mergeBackupData, type BackupData } from '@/engine/data/backup';
import { RunnerRepository } from '@/lib/storage/repository';
import { getDb } from '@/lib/storage/db';

const copy = en.settings;
const fontKey = 'reading.fontScale';
const control = 'min-h-11 rounded border-2 border-slate-700 bg-white px-4 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-60';

function validScale(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0.8 && value <= 1.6
    ? value : 1;
}

export default function SettingsPage() {
  const repository = useRef<RunnerRepository | null>(null);
  const locked = useRef(false);
  const mounted = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [fontScale, setFontScale] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>(copy.loading);
  const [failed, setFailed] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  function repo(): RunnerRepository {
    repository.current ??= new RunnerRepository();
    return repository.current;
  }

  async function run(operation: () => Promise<void>): Promise<void> {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setFailed(false);
    setMessage(copy.busy);
    try {
      await operation();
    } catch {
      if (mounted.current) {
        setFailed(true);
        setMessage(copy.error);
      }
    } finally {
      locked.current = false;
      if (mounted.current) {
        setBusy(false);
        setLoading(false);
      }
    }
  }

  async function load(): Promise<void> {
    await run(async () => {
      // Explicit open also retries Dexie's cached failure from an earlier open.
      await getDb().open();
      const value = await repo().getSetting<unknown>(fontKey, 1);
      if (mounted.current) {
        setFontScale(validScale(value));
        setMessage('');
      }
    });
  }

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; };
    // The repository is browser-only; load once after hydration.
  }, []);

  useEffect(() => {
    if (dialogOpen) {
      dialog.current?.showModal();
      cancel.current?.focus();
    }
  }, [dialogOpen]);

  async function saveFont(value: number): Promise<void> {
    await run(async () => {
      await repo().setSetting(fontKey, value);
      if (mounted.current) {
        setFontScale(value);
        setMessage(copy.saved);
      }
    });
  }

  async function exportData(): Promise<void> {
    await run(async () => {
      const report = await repo().exportDataWithReport();
      const url = URL.createObjectURL(new Blob([JSON.stringify(report.data, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = brand.backupFilename;
      try {
        document.body.append(anchor);
        anchor.click();
        if (mounted.current) setMessage(report.skippedRecords.length === 0 ? copy.exportDone : format(copy.exportSkipped, {
          n: report.data.skipped,
          records: report.skippedRecords.map((record) => format(copy.skippedRecord, {
            table: copy.tables[record.table], id: record.id ?? copy.unknownRecord,
          })).join(', '),
        }));
      } finally {
        anchor.remove();
        // Let the browser consume the download before releasing its URL.
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    });
  }

  async function importData(): Promise<void> {
    if (!file) return;
    const selected = file;
    await run(async () => {
      const text = await selected.text();
      let incoming: BackupData;
      try {
        const input: unknown = JSON.parse(text);
        incoming = backupSchema.parse(input);
      } catch {
        setMessage(copy.invalidImport);
        return;
      }
      const existing = await repo().exportData();
      let merged: BackupData;
      try {
        merged = mergeBackupData(existing, incoming);
      } catch {
        setMessage(copy.invalidImport);
        return;
      }
      // The repository revalidates inside its atomic incoming-wins transaction.
      await repo().importData(incoming);
      if (mounted.current) {
        setFontScale(validScale(merged.settings.find((setting) => setting.key === fontKey)?.value));
        setFile(null);
        if (fileInput.current) fileInput.current.value = '';
        setMessage(copy.importDone);
      }
    });
  }

  function closeDialog(): void {
    if (locked.current) return;
    dialog.current?.close();
  }

  async function deleteData(): Promise<void> {
    await run(async () => {
      await repo().deleteAllData();
      if (mounted.current) {
        setFontScale(1);
        setFile(null);
        if (fileInput.current) fileInput.current.value = '';
        setMessage(copy.deleteDone);
        dialog.current?.close();
      }
    });
  }

  const disabled = loading || busy || dialogOpen;
  return (
    <div className="mt-6 space-y-6" data-testid="settings-page" aria-busy={loading || busy}>
      <p role="status" aria-live="polite" aria-atomic="true" data-testid="settings-status">
        {dialogOpen ? '' : message}
      </p>
      {failed && !dialogOpen && <button type="button" className={control} disabled={busy} onClick={() => void load()}>{copy.retry}</button>}
      <section aria-labelledby="settings-font-heading" className="space-y-3 rounded border-2 border-slate-700 p-4">
        <h2 id="settings-font-heading" className="text-xl font-semibold">{copy.font}</h2>
        <label htmlFor="settings-font" className="block">{copy.font}</label>
        <select id="settings-font" data-testid="settings-font" className={control} value={fontScale} disabled={disabled}
          aria-describedby="settings-font-hint" onChange={(event) => void saveFont(Number(event.target.value))}>
          {Array.from(new Set([fontScale, ...Array.from({ length: 9 }, (_, index) => (8 + index) / 10)]))
            .sort((a, b) => a - b).map((scale) => <option key={scale} value={scale}>{new Intl.NumberFormat('en', { style: 'percent' }).format(scale)}</option>)}
        </select>
        <p id="settings-font-hint">{copy.fontHint}</p>
        <p data-testid="settings-font-preview" style={{ fontSize: `${fontScale}rem` }}>{copy.preview}</p>
      </section>
      <section aria-labelledby="settings-data-heading" className="space-y-4 rounded border-2 border-slate-700 p-4">
        <h2 id="settings-data-heading" className="text-xl font-semibold">{copy.dataHeading}</h2>
        <p>{copy.privacy}</p>
        <button type="button" className={control} data-testid="settings-export" disabled={disabled} onClick={() => void exportData()}>{copy.export}</button>
        <div className="space-y-3">
          <label htmlFor="settings-import" className="block">{copy.import}</label>
          <p id="settings-import-hint">{copy.importHint}</p>
          <input id="settings-import" data-testid="settings-import-file" ref={fileInput} type="file" accept=".json,application/json"
            className={`${control} w-full min-w-0 file:mr-2 file:min-h-11 file:rounded file:border-2 file:border-slate-700 file:bg-white file:text-slate-900`}
            aria-describedby="settings-import-hint" disabled={disabled} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          <button type="button" className={control} data-testid="settings-import" disabled={disabled || !file} onClick={() => void importData()}>{copy.importButton}</button>
        </div>
        <button type="button" ref={deleteButton} className={control} data-testid="settings-delete" disabled={disabled}
          onClick={() => { setMessage(''); setDialogOpen(true); }}>{copy.delete}</button>
      </section>
      <dialog ref={dialog} data-testid="settings-delete-dialog" aria-labelledby="settings-delete-heading" aria-describedby="settings-delete-detail"
        className="w-[calc(100%-2rem)] max-w-lg rounded border-2 border-slate-900 bg-white p-4 text-slate-900 backdrop:bg-slate-900/60"
        onCancel={(event) => { if (locked.current) event.preventDefault(); }}
        onClose={() => { setDialogOpen(false); requestAnimationFrame(() => deleteButton.current?.focus()); }}
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return;
          const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
          const first = buttons[0];
          const last = buttons.at(-1);
          if (!first || !last) { event.preventDefault(); return; }
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }}>
        <h2 id="settings-delete-heading" className="text-xl font-semibold">{copy.deleteHeading}</h2>
        <p id="settings-delete-detail" className="my-4">{copy.deleteDetail}</p>
        <p role="status" aria-live="polite" aria-atomic="true">{dialogOpen ? message : ''}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" ref={cancel} className={control} disabled={busy} onClick={closeDialog}>{copy.cancel}</button>
          <button type="button" className={control} data-testid="settings-delete-confirm" disabled={busy} onClick={() => void deleteData()}>{copy.confirmDelete}</button>
        </div>
      </dialog>
    </div>
  );
}