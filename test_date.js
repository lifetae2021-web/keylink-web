const eventTime = new Date('2026-05-15T20:00:00Z');
const today = new Date('2026-05-11T14:00:00Z');
today.setHours(0, 0, 0, 0);
const eventDateOnly = new Date(eventTime);
eventDateOnly.setHours(0, 0, 0, 0);
const diffTime = eventDateOnly.getTime() - today.getTime();
const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
const remainingDays = diffDays > 0 ? String(diffDays) : '0';

console.log('remainingDays:', remainingDays);
console.log('replaced:', '딱 {{남은일수}}일'.replace(/{{남은일수}}/g, remainingDays));
