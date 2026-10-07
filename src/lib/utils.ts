/**
 * v3.5.1+: Client-side image compression to bypass Firestore 1MB document limit
 * Resizes image to max 1200px and converts to JPEG (0.8 quality)
 */
export const compressImage = (base64: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Export to JPEG with 0.8 quality for significant size reduction
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      } catch (err) {
        console.error('Canvas error during compression, falling back to original:', err);
        resolve(base64); // Fallback to original
      }
    };
    img.onerror = () => {
      console.error('Image load error during compression');
      resolve(base64); // Fallback to original
    };
  });
};

/**
 * 초성 검색을 포함하는 문자열 포함 여부 확인 함수
 */
export const chosungIncludes = (target: string | undefined | null, query: string | undefined | null): boolean => {
  if (!target || !query) return false;
  
  const CHOSUNG_LIST = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  
  const getCho = (char: string) => {
    const code = char.charCodeAt(0);
    // 한글 음절 (가~힣)
    if (code >= 44032 && code <= 55203) {
      return CHOSUNG_LIST[Math.floor((code - 44032) / 588)];
    }
    return char.toLowerCase();
  };
  
  const tLen = target.length;
  const qLen = query.length;
  
  if (qLen > tLen) return false;
  
  for (let i = 0; i <= tLen - qLen; i++) {
    let match = true;
    for (let j = 0; j < qLen; j++) {
      const tChar = target[i + j];
      const qChar = query[j];
      
      // 검색어가 초성인 경우
      if (CHOSUNG_LIST.includes(qChar)) {
        if (getCho(tChar) !== qChar) {
          match = false;
          break;
        }
      } else {
        // 일반 문자인 경우 대소문자 무시 비교
        if (tChar.toLowerCase() !== qChar.toLowerCase()) {
          match = false;
          break;
        }
      }
    }
    if (match) return true;
  }
  return false;
};

// 생년월일 입력 포맷터: 6자리(940530)와 8자리(19940530) 모두 받아 'YY-MM-DD'로 정규화한다.
// 19/20으로 시작하는 7자리 이상은 YYYYMMDD 입력으로 보고 연도 앞 2자리를 버린다
// (19xx/20xx를 YY로 읽으면 2019·2020년생이 되어 성인 입력과 구분되므로 모호하지 않다).
export const formatBirthDate = (val: string): string => {
  let d = val.replace(/[^0-9]/g, '');
  if (d.length >= 7 && /^(19|20)/.test(d)) d = d.slice(2);
  d = d.slice(0, 6);
  if (d.length > 4) return `${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4)}`;
  if (d.length > 2) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return d;
};

// 'YY-MM-DD' 형식, 월/일 범위, 나이 18~70세 범위인지 검사
export const isValidBirthDate = (val: string): boolean => {
  const m = /^(\d{2})-(\d{2})-(\d{2})$/.exec(val.trim());
  if (!m) return false;
  const yy = Number(m[1]), mm = Number(m[2]), dd = Number(m[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return false;
  const year = yy > 30 ? 1900 + yy : 2000 + yy;
  const age = new Date().getFullYear() - year;
  return age >= 18 && age <= 70;
};
