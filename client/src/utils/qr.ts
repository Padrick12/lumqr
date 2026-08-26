import QRCode from 'qrcode';

export async function generateQRDataURL(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 256,
      color: {
        dark: '#0f172a', // Tailwind slate-900
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.error('Error generating QR code:', err);
    return '';
  }
}

export async function generateLabelDataURL(text: string): Promise<string> {
  try {
    const qrDataUrl = await generateQRDataURL(text);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const padding = 20;
        const textHeight = 40;
        
        canvas.width = img.width + padding * 2;
        canvas.height = img.height + padding * 2 + textHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(qrDataUrl);
        
        // Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw QR
        ctx.drawImage(img, padding, padding);
        
        // Draw Text
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, canvas.width / 2, canvas.height - padding - 10);
        
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = qrDataUrl;
    });
  } catch (err) {
    console.error('Error generating label:', err);
    return '';
  }
}
