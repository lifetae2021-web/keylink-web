/**
 * v3.5.1+: Client-side image compression to bypass Firestore 1MB document limit
 * Resizes image to max 1200px and converts to JPEG (0.8 quality)
 */
export const compressImage = (base64: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
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
