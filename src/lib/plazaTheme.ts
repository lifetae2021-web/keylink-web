import { adminDb } from '@/lib/firebaseAdmin';
import { sanitizeTheme, DEFAULT_THEME } from '../../public/plaza/themes.js';

// 키링 월드 테마 설정 — plazaConfig/theme { theme, until(종료 시각, 없으면 계속), updatedBy, updatedAt } (서버만 읽고 씀)
// until이 지나면 기본 테마로 돌아간다(다시 배포하지 않아도 됨).
// 로컬 개발 서버와 운영이 같은 문서를 쓴다(로컬 관리자 화면에서 바꿔도 운영 사이트에 그대로 적용 — 사용자 요청)
// ⚠️ 그래서 테마를 바꾸는 시험은 운영에도 바로 보인다. 시험은 테마를 바꾸지 말고 주소 ?theme=xmas 미리보기로 한다.
export const THEME_DOC = 'plazaConfig/theme';
let cache: { at: number; value: { theme: string; until: number | null } } | null = null;

export async function getThemeSetting(): Promise<{ theme: string; until: number | null }> {
  const d = (await adminDb.doc(THEME_DOC).get()).data() || {};
  const until = d.until?.toMillis?.() ?? null;
  return { theme: sanitizeTheme(d.theme), until };
}

export async function getActiveTheme(): Promise<string> {
  if (!cache || Date.now() - cache.at > 20_000) cache = { at: Date.now(), value: await getThemeSetting() };
  const { theme, until } = cache.value;
  return until && Date.now() > until ? DEFAULT_THEME : theme;
}

export function clearThemeCache() { cache = null; }
