function applyVariables(content, applicant, session) {
  const eventTime = session?.eventDate?.toDate?.() ?? new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDateOnly = new Date(eventTime);
  eventDateOnly.setHours(0, 0, 0, 0);
  const diffTime = eventDateOnly.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  const remainingDays = diffDays > 0 ? String(diffDays) : '0';

  return content.replace(/{{남은일수}}/g, remainingDays);
}

const content = "딱 {{남은일수}}일 남았습니다!";
const session = { eventDate: { toDate: () => new Date('2026-05-15T20:00:00Z') } };
console.log(applyVariables(content, null, session));
