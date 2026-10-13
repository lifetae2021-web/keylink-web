import { normalizeBirthDate } from '@/lib/utils';

export interface ProfileChangeLog {
  field: string;
  oldValue: string;
  newValue: string;
  changedAt: string;
}

// 이 항목이 바뀌면 인증이 취소되고 재승인 대기로 돌아가는 핵심 정보 (마이페이지 기존 규칙 유지)
export const CORE_PROFILE_FIELDS = ['name', 'gender', 'birthDate', 'phone', 'workplace', 'employmentProof', 'photos'];

const EMPTY = '미입력';
const str = (v: unknown) => (v == null ? '' : String(v).trim());
const list = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean).join(', ') : str(v));
const digits = (v: unknown) => str(v).replace(/\D/g, '');

const avoidSummary = (v: unknown) =>
  (Array.isArray(v) ? v : [])
    .filter((e: any) => e && str(e.name))
    .map((e: any) => {
      const detail = [str(e.birthYear) && `${str(e.birthYear)}년생`, str(e.workplace)].filter(Boolean).join(', ');
      return detail ? `${str(e.name)}(${detail})` : str(e.name);
    })
    .join(', ');

const genderLabel = (v: unknown) => (v === 'male' ? '남성' : v === 'female' ? '여성' : str(v));

// [항목, 표시용 값 읽기, 비교용 값 읽기(생략 시 표시용 값과 동일)]
const FIELDS: Array<[string, (d: any) => string, ((d: any) => string)?]> = [
  ['name', d => str(d.name)],
  ['gender', d => genderLabel(d.gender)],
  ['birthDate', d => normalizeBirthDate(d.birthDate)],
  ['phone', d => str(d.phone), d => digits(d.phone)],
  ['workplace', d => str(d.workplace || d.jobRole || d.job)],
  ['instaId', d => str(d.instaId)],
  ['height', d => str(d.height)],
  ['weight', d => str(d.weight)],
  ['residence', d => str(d.residence)],
  ['smoking', d => str(d.smoking)],
  ['drinking', d => str(d.drinking)],
  ['religion', d => str(d.religion)],
  ['drink', d => list(d.drink)],
  ['idealType', d => str(d.idealType)],
  ['nonIdealType', d => str(d.nonIdealType)],
  ['etc', d => str(d.etc)],
  ['avoidAcquaintance', d => str(d.avoidAcquaintance)],
  ['avoidList', d => avoidSummary(d.avoidList)],
];

/**
 * 저장 전 데이터(oldData)와 저장할 데이터(newData)를 비교해 바뀐 항목마다 로그 한 건씩 만든다.
 * newData에 없는 항목(저장하지 않는 값)은 비교하지 않는다.
 */
export function buildProfileChangeLogs(oldData: any, newData: any, changedAt: string = new Date().toISOString()): ProfileChangeLog[] {
  const logs: ProfileChangeLog[] = [];
  const o = oldData || {};
  const n = newData || {};
  const has = (key: string) => Object.prototype.hasOwnProperty.call(n, key);

  for (const [field, read, compare] of FIELDS) {
    // 'workplace'는 구버전 호환 때문에 jobRole/job도 같은 항목으로 본다
    const present = field === 'workplace' ? has('workplace') || has('jobRole') : has(field);
    if (!present) continue;
    const cmp = compare || read;
    if (cmp(o) === cmp(n)) continue;
    logs.push({ field, oldValue: read(o) || EMPTY, newValue: read(n) || EMPTY, changedAt });
  }

  if (has('employmentProof')) {
    const oldProof = o.employmentProof || o.verificationUrl || '';
    const newProof = n.employmentProof || '';
    if (oldProof !== newProof) {
      logs.push({
        field: 'employmentProof',
        oldValue: oldProof ? '이전 재직 증명 서류' : EMPTY,
        newValue: newProof ? '새로운 재직 증명 서류' : '삭제됨',
        changedAt,
      });
    }
  }

  if (has('photos')) {
    const oldPhotos = Array.isArray(o.photos) ? o.photos : [];
    const newPhotos = Array.isArray(n.photos) ? n.photos : [];
    if (JSON.stringify(oldPhotos) !== JSON.stringify(newPhotos)) {
      logs.push({ field: 'photos', oldValue: `이전 사진 ${oldPhotos.length}장`, newValue: `새로운 사진 ${newPhotos.length}장`, changedAt });
    }
  }

  return logs;
}
