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
