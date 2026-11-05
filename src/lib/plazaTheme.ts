import { adminDb } from '@/lib/firebaseAdmin';
import { sanitizeTheme, DEFAULT_THEME } from '../../public/plaza/themes.js';

// 키링 월드 테마 설정 — plazaConfig/theme { theme, until(종료 시각, 없으면 계속), updatedBy, updatedAt } (서버만 읽고 씀)
// until이 지나면 기본 테마로 돌아간다(다시 배포하지 않아도 됨).
let cache: { at: number; value: { theme: string; until: number | null } } | null = null;

export async function getThemeSetting(): Promise<{ theme: string; until: number | null }> {
  const d = (await adminDb.doc('plazaConfig/theme').get()).data() || {};
  const until = d.until?.toMillis?.() ?? null;
  return { theme: sanitizeTheme(d.theme), until };
}

export async function getActiveTheme(): Promise<string> {
  if (!cache || Date.now() - cache.at > 20_000) cache = { at: Date.now(), value: await getThemeSetting() };
  const { theme, until } = cache.value;
  return until && Date.now() > until ? DEFAULT_THEME : theme;
}

export function clearThemeCache() { cache = null; }
