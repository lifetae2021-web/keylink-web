function applyVariables(content, applicant, session) {
  const eventTime = session?.eventDate?.toDate?.() ?? new Date();
  const formatter = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric', day: 'numeric', weekday: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = formatter.formatToParts(eventTime);
  const getPart = (t) => parts.find(p => p.type === t)?.value ?? '';

  const genderPrice = 49000;
  const sessionName = '부산 124기';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDateOnly = new Date(eventTime);
  eventDateOnly.setHours(0, 0, 0, 0);
  const diffTime = eventDateOnly.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  const remainingDays = diffDays > 0 ? String(diffDays) : '0';

  return content
    .replace(/{{이름}}/g, applicant?.name || applicant?.userName || '참가자')
    .replace(/{{날짜}}/g, `${getPart('month')}/${getPart('day')}`)
    .replace(/{{요일}}/g, getPart('weekday'))
    .replace(/{{시간}}/g, `${getPart('hour')}:${getPart('minute')}`)
    .replace(/{{금액}}/g, (applicant?.price || genderPrice).toLocaleString('ko-KR'))
    .replace(/{{기수}}/g, sessionName)
    .replace(/{{장소}}/g, session?.venue || session?.location || '')
    .replace(/{{남은일수}}/g, remainingDays);
}

const content = "[키링크] 행사까지 딱 {{남은일수}}일 남았습니다!";
const session = { eventDate: { toDate: () => new Date('2026-05-15T20:00:00Z') } };
console.log(applyVariables(content, null, session));
