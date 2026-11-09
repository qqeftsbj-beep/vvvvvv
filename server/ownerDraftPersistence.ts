import { eq } from 'drizzle-orm';
import { ownerEditorDrafts } from '../drizzle/schema';
import { getDb } from './db';

export async function saveOwnerWorkingDraft(content: Record<string, unknown>) {
  const serialized = JSON.stringify(content);
  if (Buffer.byteLength(serialized, 'utf8') > 8 * 1024 * 1024) throw new Error('المسودة كبيرة جدًا. احفظ الملفات في مكتبة الوسائط بدل بيانات Base64.');
  const db = await getDb();
  if (!db) throw new Error('قاعدة البيانات غير متاحة.');
  await db.insert(ownerEditorDrafts).values({ id: 1, contentJson: serialized }).onDuplicateKeyUpdate({ set: { contentJson: serialized } });
  const row = await db.select().from(ownerEditorDrafts).where(eq(ownerEditorDrafts.id, 1)).limit(1);
  if (row[0]?.contentJson !== serialized) throw new Error('لم يُؤكد حفظ المسودة.');
  return { success: true as const, savedAt: row[0].updatedAt.getTime() };
}
export async function readOwnerWorkingDraft() {
  const db = await getDb();
  if (!db) throw new Error('قاعدة البيانات غير متاحة.');
  const row = await db.select().from(ownerEditorDrafts).where(eq(ownerEditorDrafts.id, 1)).limit(1);
  if (!row[0]) return null;
  return { content: JSON.parse(row[0].contentJson) as Record<string, unknown>, savedAt: row[0].updatedAt.getTime() };
}
export async function clearOwnerWorkingDraft() {
  const db = await getDb();
  if (!db) throw new Error('قاعدة البيانات غير متاحة.');
  await db.delete(ownerEditorDrafts).where(eq(ownerEditorDrafts.id, 1));
  return { success: true as const };
}
export function publicSiteContent(value: Record<string, unknown>) {
  const next = { ...value };
  if (Array.isArray(next.pages)) next.pages = next.pages.filter((page: any) => page && page.visible !== false && page.status !== 'draft').map((page: any) => { const { draft, draftSavedAt, ...published } = page; return published; });
  if (next.settings && typeof next.settings === 'object') { const { templatePassword, ...settings } = next.settings as Record<string, unknown>; next.settings = settings; }
  return next;
}
