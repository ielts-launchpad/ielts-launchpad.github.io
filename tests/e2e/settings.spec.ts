import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { backupSchema, validateBackupRelations, type BackupData } from '../../src/engine/data/backup';
import { en } from '../../src/i18n/en';
import { format } from '../../src/i18n/format';
import { expectNoA11yViolations } from './helpers/a11y';
import { gotoListening, waitListeningSaved } from './helpers/listening';

const copy = en.settings;
const tableNames = ['attempts', 'answers', 'results', 'highlights', 'settings'] as const;

async function gotoSettings(page: Page): Promise<void> {
  await page.goto('/settings');
  await expect(page.getByTestId('settings-font')).toBeEnabled();
}

async function saveFont(page: Page, scale: string): Promise<void> {
  await page.getByTestId('settings-font').selectOption(scale);
  await expect(page.getByTestId('settings-status')).toHaveText(copy.saved);
}

async function exportBackup(page: Page, skippedRecords: { table: keyof typeof copy.tables; id: string | null }[] = []): Promise<BackupData> {
  const status = skippedRecords.length === 0 ? copy.exportDone : format(copy.exportSkipped, {
    n: skippedRecords.length,
    records: skippedRecords.map((record) => format(copy.skippedRecord, {
      table: copy.tables[record.table], id: record.id ?? copy.unknownRecord,
    })).join(', '),
  });
  const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
  await page.getByTestId('settings-export').click();
  await expect(page.getByTestId('settings-status')).not.toHaveText(copy.busy);
  if (await page.getByTestId('settings-status').textContent() === copy.error) {
    throw new Error('Repository export failed');
  }
  await expect(page.getByTestId('settings-status')).toHaveText(status);
  const download = await downloadPromise;
  if (!download) throw new Error('Export did not produce a download');
  expect(download.suggestedFilename()).toBe('ielts-launchpad-backup.json');
  const path = await download.path();
  if (!path) throw new Error('Download did not produce a local file');
  const input: unknown = JSON.parse(await readFile(path, 'utf8'));
  const data = backupSchema.parse(input);
  expect(data.skipped).toBe(skippedRecords.length);
  expect(input).not.toHaveProperty('skippedRecords');
  validateBackupRelations(data);
  await expect(page.getByTestId('settings-status')).toHaveText(status);
  return data;
}

async function selectBackup(page: Page, input: unknown): Promise<void> {
  await page.getByTestId('settings-import-file').setInputFiles({
    name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(input)),
  });
}

async function importBackup(page: Page, input: unknown): Promise<void> {
  await selectBackup(page, input);
  await page.getByTestId('settings-import').click();
  await expect(page.getByTestId('settings-status')).toHaveText(copy.importDone);
  await expect(page.getByTestId('settings-import-file')).toHaveValue('');
  await expect(page.getByTestId('settings-import')).toBeDisabled();
}

async function completeListening(page: Page): Promise<string> {
  await gotoListening(page);
  await page.getByTestId('gap-L1-q1').fill('main entrance');
  await page.getByTestId('submit-button').click();
  await page.getByTestId('submit-confirm-yes').click();
  await waitListeningSaved(page);
  await page.getByTestId('results-link').click();
  await expect(page.getByTestId('results-score')).toHaveText('1/4');
  return page.url();
}

/** Populate the note table through the actual import UI, retaining a real review. */
async function populatedBackup(page: Page): Promise<{ data: BackupData; resultUrl: string }> {
  await gotoSettings(page);
  await saveFont(page, '1.3');
  const resultUrl = await completeListening(page);
  await gotoSettings(page);
  const exported = await exportBackup(page);
  expect(exported.attempts).toHaveLength(1);
  expect(exported.results[0].review?.answers['L1-q1']).toBe('main entrance');
  const attempt = exported.attempts[0];
  const data = backupSchema.parse({
    ...exported,
    highlights: [{ id: 'backup-highlight', attemptId: attempt.id, passage: 1, paragraphIndex: 0,
      start: 0, end: 4, quote: 'note', note: 'Private study note', createdAt: attempt.startedAt }],
    settings: [...exported.settings, { key: 'settings-test-retained', value: { local: true } }],
  });
  validateBackupRelations(data);
  await importBackup(page, data);
  const actual = await exportBackup(page);
  for (const name of tableNames) expect(actual[name].length).toBeGreaterThan(0);
  return { data: actual, resultUrl };
}

async function confirmDelete(page: Page): Promise<void> {
  await page.getByTestId('settings-delete').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByTestId('settings-delete-confirm').click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByTestId('settings-status')).toHaveText(copy.deleteDone);
  await expect(page.getByTestId('settings-delete')).toBeFocused();
}

test('font persists after reload, applies to new attempts, and does not change resumed attempts', async ({ page, context }) => {
  await gotoSettings(page);
  await expect(page.getByText(copy.fontHint)).toBeVisible();
  await saveFont(page, '1.4');
  await page.reload();
  await expect(page.getByTestId('settings-font')).toHaveValue('1.4');
  await expect(page.getByTestId('settings-font-preview')).toHaveCSS('font-size', '22.4px');
  await gotoListening(page);
  await waitListeningSaved(page);
  await expect(page.getByTestId('listening-questions').locator('..')).toHaveCSS('font-size', '22.4px');
  await gotoSettings(page);
  await saveFont(page, '0.8');
  await gotoListening(page);
  await waitListeningSaved(page);
  await expect(page.getByTestId('listening-questions').locator('..')).toHaveCSS('font-size', '22.4px');
  await completeListening(page);
  await gotoListening(page);
  await waitListeningSaved(page);
  await expect(page.getByTestId('listening-questions').locator('..')).toHaveCSS('font-size', '12.8px');
  await gotoSettings(page);
  const backup = await exportBackup(page);
  expect(backup.attempts.map((attempt) => attempt.fontScale).sort()).toEqual([0.8, 1.4]);
  expect(await context.cookies()).toEqual([]);
});

test('completed Listening backup includes all five tables; delete/import restores Results and settings', async ({ page, context }) => {
  const { data, resultUrl } = await populatedBackup(page);
  await expect(page.getByText(copy.privacy)).toBeVisible();
  await expect(page.getByText(copy.importHint)).toBeVisible();
  await confirmDelete(page);
  const empty = await exportBackup(page);
  for (const name of tableNames) expect(empty[name]).toEqual([]);
  await expect(page.getByTestId('settings-font')).toHaveValue('1');
  await page.goto(resultUrl);
  await expect(page.getByRole('heading', { name: en.results.notFound })).toBeVisible();
  await gotoSettings(page);
  await importBackup(page, data);
  expect(await exportBackup(page)).toEqual(data);
  await expect(page.getByTestId('settings-font')).toHaveValue('1.3');
  await page.goto(resultUrl);
  await expect(page.getByTestId('results-score')).toHaveText('1/4');
  await expect(page.getByTestId('review-L1-q1')).toContainText('main entrance');
  expect(await context.cookies()).toEqual([]);
});

test('incoming matching IDs win in every table while unrelated records are preserved', async ({ page }) => {
  const { data } = await populatedBackup(page);
  await gotoListening(page);
  await page.getByTestId('gap-L1-q2').fill('north gate');
  await waitListeningSaved(page);
  await gotoSettings(page);
  const before = await exportBackup(page);
  const incoming = backupSchema.parse({
    ...data,
    attempts: data.attempts.map((record) => ({ ...record, flagged: ['L1-q2'] })),
    answers: data.answers.map((record) => ({ ...record, updatedAt: record.updatedAt + 1 })),
    results: data.results.map((record) => ({ ...record, createdAt: record.createdAt + 1 })),
    highlights: data.highlights.map((record) => ({ ...record, note: 'Incoming note wins' })),
    settings: [{ key: 'reading.fontScale', value: 1.6 }],
  });
  await importBackup(page, incoming);
  const after = await exportBackup(page);
  expect(after.attempts.find((record) => record.id === data.attempts[0].id)).toEqual(incoming.attempts[0]);
  expect(after.answers.find((record) => record.attemptId === data.attempts[0].id)).toEqual(incoming.answers[0]);
  expect(after.results).toEqual(incoming.results);
  expect(after.highlights).toEqual(incoming.highlights);
  expect(after.settings.find((record) => record.key === 'reading.fontScale')?.value).toBe(1.6);
  expect(after.settings.find((record) => record.key === 'settings-test-retained')).toEqual(
    before.settings.find((record) => record.key === 'settings-test-retained'));
  const unrelated = before.attempts.find((record) => record.id !== data.attempts[0].id);
  expect(unrelated).toBeDefined();
  expect(after.attempts.find((record) => record.id === unrelated?.id)).toEqual(unrelated);
  expect(after.answers.find((record) => record.attemptId === unrelated?.id)).toEqual(
    before.answers.find((record) => record.attemptId === unrelated?.id));
});

test('partial export downloads valid records, reports only identities, leaves corruption untouched and imports into a clean database', async ({ page }) => {
  const { data } = await populatedBackup(page);
  const corruptId = '<img src=x onerror=alert(1)>-corrupt-setting';
  const orphanId = 'orphan-answer';
  await page.evaluate(async ({ corruptId, orphanId }) => {
    const request = indexedDB.open('ielts-launchpad');
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Could not seed test database'));
    });
    try {
      const transaction = database.transaction(['settings', 'answers'], 'readwrite');
      const done = new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(new Error('Could not seed test records'));
        transaction.onabort = () => reject(new Error('Could not seed test records'));
      });
      transaction.objectStore('settings').put({ key: corruptId, value: { private: 'CORRUPT_VALUE_NOT_FOR_EXPORT', invalid: NaN } });
      transaction.objectStore('answers').put({ attemptId: orphanId, answers: { private: 'ORPHAN_ANSWER_NOT_FOR_EXPORT' }, updatedAt: 1 });
      await done;
    } finally { database.close(); }
  }, { corruptId, orphanId });
  const exported = await exportBackup(page, [{ table: 'answers', id: orphanId }, { table: 'settings', id: corruptId }]);
  expect(exported).toEqual({ ...data, skipped: 2 });
  expect(JSON.stringify(exported)).not.toContain('CORRUPT_VALUE_NOT_FOR_EXPORT');
  expect(JSON.stringify(exported)).not.toContain('ORPHAN_ANSWER_NOT_FOR_EXPORT');
  expect(JSON.stringify(exported)).not.toContain('NaN');
  await expect(page.getByTestId('settings-status').locator('img')).toHaveCount(0);
  await expect(page.getByTestId('settings-status')).not.toContainText('CORRUPT_VALUE_NOT_FOR_EXPORT');
  await expect(page.getByTestId('settings-status')).not.toContainText('ORPHAN_ANSWER_NOT_FOR_EXPORT');
  const retained = await page.evaluate(async ({ corruptId, orphanId }) => {
    const request = indexedDB.open('ielts-launchpad');
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Could not inspect test database'));
    });
    function read<T>(query: IDBRequest<T>): Promise<T> {
      return new Promise((resolve, reject) => {
        query.onsuccess = () => resolve(query.result);
        query.onerror = () => reject(new Error('Could not inspect test records'));
      });
    }
    try {
      const counts = await Promise.all(['attempts', 'answers', 'results', 'highlights', 'settings'].map((table) =>
        read(database.transaction(table).objectStore(table).count())));
      const setting = await read(database.transaction('settings').objectStore('settings').get(corruptId)) as
        { value: { private: string; invalid: number } };
      const answer = await read(database.transaction('answers').objectStore('answers').get(orphanId)) as
        { answers: { private: string } };
      return { counts, corruptUnchanged: Number.isNaN(setting.value.invalid) && setting.value.private === 'CORRUPT_VALUE_NOT_FOR_EXPORT',
        orphanUnchanged: answer.answers.private === 'ORPHAN_ANSWER_NOT_FOR_EXPORT' };
    } finally { database.close(); }
  }, { corruptId, orphanId });
  expect(retained).toEqual({ counts: tableNames.map((table) => data[table].length + (table === 'answers' || table === 'settings' ? 1 : 0)),
    corruptUnchanged: true, orphanUnchanged: true });
  // The actual repository must reject retained corruption, despite safe UI prevalidation.
  await selectBackup(page, exported);
  await page.getByTestId('settings-import').click();
  await expect(page.getByTestId('settings-status')).toHaveText(copy.error);
  expect(await exportBackup(page, [{ table: 'answers', id: orphanId }, { table: 'settings', id: corruptId }])).toEqual(exported);
  await confirmDelete(page);
  await importBackup(page, exported);
  expect(await exportBackup(page)).toEqual(data);
});

test('malformed JSON, invalid schema and orphaned records leave every table unchanged', async ({ page }) => {
  const { data } = await populatedBackup(page);
  await page.getByTestId('settings-import-file').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{broken') });
  await page.getByTestId('settings-import').click();
  await expect(page.getByTestId('settings-status')).toHaveText(copy.invalidImport);
  expect(await exportBackup(page)).toEqual(data);
  for (const input of [{ ...data, version: 2 }, { ...data, attempts: [], answers: [{ attemptId: 'missing-parent', answers: {}, updatedAt: 1 }] }]) {
    await selectBackup(page, input);
    await page.getByTestId('settings-import').click();
    await expect(page.getByTestId('settings-status')).toHaveText(copy.invalidImport);
    await expect(page.getByTestId('settings-import-file')).not.toHaveValue('');
    expect(await exportBackup(page)).toEqual(data);
  }
});

test('Cancel and Escape retain records, trap/return focus; confirmed delete permits a fresh attempt', async ({ page, context }) => {
  const { data } = await populatedBackup(page);
  for (const action of ['cancel', 'escape'] as const) {
    await page.getByTestId('settings-delete').click();
    const cancel = page.getByRole('button', { name: copy.cancel, exact: true });
    await expect(cancel).toBeFocused();
    await expect(page.getByTestId('settings-export')).toBeDisabled();
    await expect(page.getByTestId('settings-font')).toBeDisabled();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByTestId('settings-delete-confirm')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(cancel).toBeFocused();
    await expectNoA11yViolations(page);
    if (action === 'cancel') await cancel.click();
    else await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByTestId('settings-delete')).toBeFocused();
    expect(await exportBackup(page)).toEqual(data);
  }
  await confirmDelete(page);
  const empty = await exportBackup(page);
  for (const name of tableNames) expect(empty[name]).toEqual([]);
  await gotoListening(page);
  await page.getByTestId('gap-L1-q1').fill('fresh attempt');
  await waitListeningSaved(page);
  await gotoSettings(page);
  const fresh = await exportBackup(page);
  expect(fresh.attempts).toHaveLength(1);
  expect(fresh.attempts[0].id).not.toBe(data.attempts[0].id);
  expect(fresh.attempts[0].fontScale).toBe(1);
  expect(fresh.answers[0].answers['L1-q1']).toBe('fresh attempt');
  expect(fresh.results).toEqual([]);
  expect(fresh.highlights).toEqual([]);
  expect(fresh.settings).toEqual([]);
  expect(await context.cookies()).toEqual([]);
});

test('storage failure is generic and retry recovers without losing page controls', async ({ page }) => {
  await page.addInitScript(() => {
    const original = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (...args) {
      if (sessionStorage.getItem('settings-storage-recovered') !== 'true') throw new Error('Private failure detail');
      return original.apply(this, args);
    };
  });
  await page.goto('/settings');
  await expect(page.getByTestId('settings-status')).toHaveText(copy.error);
  await expect(page.getByTestId('settings-font')).toBeEnabled();
  await expect(page.getByText('Private failure detail')).toHaveCount(0);
  await page.evaluate(() => sessionStorage.setItem('settings-storage-recovered', 'true'));
  await page.getByRole('button', { name: copy.retry }).click();
  await expect(page.getByTestId('settings-status')).toHaveText('');
  await saveFont(page, '1.2');
  await page.reload();
  await expect(page.getByTestId('settings-font')).toHaveValue('1.2');
});

test('file read failure is generic, retains selection, and retry import works', async ({ page }) => {
  await gotoSettings(page);
  const data = await exportBackup(page);
  await selectBackup(page, data);
  await page.evaluate(() => {
    const original = File.prototype.text;
    File.prototype.text = async function () {
      File.prototype.text = original;
      throw new Error('Private file read failure');
    };
  });
  await page.getByTestId('settings-import').click();
  await expect(page.getByTestId('settings-status')).toHaveText(copy.error);
  await expect(page.getByTestId('settings-import-file')).not.toHaveValue('');
  await expect(page.getByText('Private file read failure')).toHaveCount(0);
  await page.getByTestId('settings-import').click();
  await expect(page.getByTestId('settings-status')).toHaveText(copy.importDone);
});

test('pending import disables other operations and safely releases them after success', async ({ page }) => {
  await gotoSettings(page);
  const data = await exportBackup(page);
  await selectBackup(page, data);
  await page.evaluate(() => {
    const original = File.prototype.text;
    File.prototype.text = async function () {
      await new Promise<void>((resolve) => { document.addEventListener('settings-test-release', () => resolve(), { once: true }); });
      return original.call(this);
    };
  });
  await page.getByTestId('settings-import').click();
  await expect(page.getByTestId('settings-status')).toHaveText(copy.busy);
  for (const id of ['settings-font', 'settings-export', 'settings-import-file', 'settings-import', 'settings-delete']) {
    await expect(page.getByTestId(id)).toBeDisabled();
  }
  await page.evaluate(() => document.dispatchEvent(new Event('settings-test-release')));
  await expect(page.getByTestId('settings-status')).toHaveText(copy.importDone);
  await expect(page.getByTestId('settings-export')).toBeEnabled();
});

test('valid JSON fixture imports all tables and confirmed delete clears them without closing the database', async ({ page }) => {
  await gotoSettings(page);
  const data = backupSchema.parse({
    version: 1,
    attempts: [{ id: 'settings-fixture', testId: 'sample-01', skill: 'listening', mode: 'practice',
      status: 'submitted', startedAt: 1, updatedAt: 2, submittedAt: 2, flagged: [], fontScale: 1.2 }],
    answers: [{ attemptId: 'settings-fixture', answers: { 'L1-q1': 'main entrance' }, updatedAt: 2 }],
    results: [{ attemptId: 'settings-fixture', testId: 'sample-01', skill: 'listening', raw: 1, max: 1, createdAt: 2,
      results: [{ questionId: 'L1-q1', numbers: [1], marks: 1, maxMarks: 1, correct: true, errorClass: null }] }],
    highlights: [{ id: 'settings-fixture-highlight', attemptId: 'settings-fixture', passage: 1,
      paragraphIndex: 0, start: 0, end: 4, quote: 'note', note: 'Study note', createdAt: 1 }],
    settings: [{ key: 'reading.fontScale', value: 1.2 }],
  });
  await importBackup(page, data);
  expect(await exportBackup(page)).toEqual(data);
  await page.getByTestId('settings-delete').click();
  await expect(page.getByRole('button', { name: copy.cancel, exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('settings-delete')).toBeFocused();
  expect(await exportBackup(page)).toEqual(data);
  await page.getByTestId('settings-delete').click();
  await page.getByRole('button', { name: copy.cancel, exact: true }).click();
  await expect(page.getByTestId('settings-delete')).toBeFocused();
  expect(await exportBackup(page)).toEqual(data);
  await confirmDelete(page);
  const empty = await exportBackup(page);
  for (const name of tableNames) expect(empty[name]).toEqual([]);
  await saveFont(page, '1.4');
  await gotoListening(page);
  await page.getByTestId('gap-L1-q1').fill('fresh answer');
  await waitListeningSaved(page);
  await page.reload();
  await expect(page.getByTestId('gap-L1-q1')).toHaveValue('fresh answer');
});

test('failed font write keeps the saved value and controls recover for the next write', async ({ page }) => {
  await gotoSettings(page);
  await saveFont(page, '1.2');
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'settings') {
        IDBObjectStore.prototype.put = original;
        throw new Error('Private write failure');
      }
      return original.apply(this, args);
    };
  });
  await page.getByTestId('settings-font').selectOption('1.6');
  await expect(page.getByTestId('settings-status')).toHaveText(copy.error);
  await expect(page.getByTestId('settings-font')).toHaveValue('1.2');
  await expect(page.getByTestId('settings-export')).toBeEnabled();
  await expect(page.getByText('Private write failure')).toHaveCount(0);
  await saveFont(page, '1.4');
  await page.reload();
  await expect(page.getByTestId('settings-font')).toHaveValue('1.4');
});

for (const width of [1280, 360]) {
  test(`Settings and confirmation are accessible at ${width}px with no cookies`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 800 });
    await gotoSettings(page);
    await expectNoA11yViolations(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    for (const node of await page.locator('[data-testid="settings-page"] button:visible, [data-testid="settings-page"] select').all()) {
      expect((await node.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByTestId('settings-delete').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectNoA11yViolations(page);
    const box = await page.getByRole('dialog').boundingBox();
    expect(box?.width).toBeLessThanOrEqual(width - 32);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('settings-delete')).toBeFocused();
    expect(await context.cookies()).toEqual([]);
  });
}