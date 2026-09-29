// 벚꽃/낙엽/눈 이펙트의 "지금 활성화되어 있는가" 판정 로직을 한 곳에서 관리.
// CherryBlossoms/AutumnLeaves/Snow 파티클 컴포넌트가 공통으로 사용한다.

function isWithinRange(settings: any, startMonthField: string, startDayField: string, endMonthField: string, endDayField: string, defaults: [number, number, number, number]): boolean {
  const startMonth = settings?.[startMonthField] || defaults[0];
  const startDay = settings?.[startDayField] || defaults[1];
  const endMonth = settings?.[endMonthField] || defaults[2];
  const endDay = settings?.[endDayField] || defaults[3];

  const now = new Date();
  const today = (now.getMonth() + 1) * 100 + now.getDate();
  const start = startMonth * 100 + startDay;
  const end = endMonth * 100 + endDay;

  if (start <= end) {
    return today >= start && today <= end;
  }
  // 범위가 연말을 넘어가는 경우 (예: 12월~2월)
  return today >= start || today <= end;
}

// mode 미설정 시 기존 동작(항상 표시)을 그대로 유지하기 위해 기본값은 'on'
export function isCherryBlossomActive(settings: any): boolean {
  const mode = settings?.cherryBlossomMode || 'on';
  if (mode === 'off') return false;
  if (mode === 'on') return true;
  return isWithinRange(settings, 'cherryBlossomStartMonth', 'cherryBlossomStartDay', 'cherryBlossomEndMonth', 'cherryBlossomEndDay', [3, 1, 4, 15]);
}

// 신규 이펙트라 명시적으로 켜기 전까지는 노출하지 않도록 기본값은 'off'
export function isAutumnLeavesActive(settings: any): boolean {
  const mode = settings?.autumnLeavesMode || 'off';
  if (mode === 'off') return false;
  if (mode === 'on') return true;
  return isWithinRange(settings, 'autumnLeavesStartMonth', 'autumnLeavesStartDay', 'autumnLeavesEndMonth', 'autumnLeavesEndDay', [9, 15, 11, 30]);
}

export function isSnowActive(settings: any): boolean {
  const mode = settings?.snowMode || 'off';
  if (mode === 'off') return false;
  if (mode === 'on') return true;
  return isWithinRange(settings, 'snowStartMonth', 'snowStartDay', 'snowEndMonth', 'snowEndDay', [12, 1, 2, 28]);
}
