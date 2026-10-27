self.onmessage = async function (e) {
  const { action, imageData, options } = e.data;

  try {
    if (action === 'compress' || action === 'convert') {
      const bitmap = await createImageBitmap(new Blob([imageData]));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);

      const format = options.format || 'image/jpeg';
      const quality = (options.quality ?? 80) / 100;
      const blob = await canvas.convertToBlob({ type: format, quality });
      const buffer = await blob.arrayBuffer();

      self.postMessage({
        success: true,
        data: buffer,
        width: bitmap.width,
        height: bitmap.height,
        size: buffer.byteLength,
        format,
      }, [buffer]);
    }

    else if (action === 'resize') {
      const bitmap = await createImageBitmap(new Blob([imageData]));
      const { width, height } = options;
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0, width, height);

      const format = options.format || 'image/png';
      const quality = (options.quality ?? 90) / 100;
      const blob = await canvas.convertToBlob({ type: format, quality });
      const buffer = await blob.arrayBuffer();

      self.postMessage({
        success: true,
        data: buffer,
        width,
        height,
        size: buffer.byteLength,
        format,
      }, [buffer]);
    }

    else if (action === 'filter') {
      const bitmap = await createImageBitmap(new Blob([imageData]));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);

      const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageDataObj.data;
      const { brightness = 0, contrast = 0, saturation = 0, grayscale = false, sepia = false, invert = false, blur = 0, hueRotate = 0 } = options;

      for (let i = 0; i < pixels.length; i += 4) {
        let r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];

        // Brightness
        const bAdj = brightness * 2.55;
        r += bAdj; g += bAdj; b += bAdj;

        // Contrast
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
        r = factor * (r - 128) + 128;
        g = factor * (g - 128) + 128;
        b = factor * (b - 128) + 128;

        // Saturation
        const gray = 0.2989 * r + 0.587 * g + 0.114 * b;
        const s = 1 + saturation / 100;
        r = gray + s * (r - gray);
        g = gray + s * (g - gray);
        b = gray + s * (b - gray);

        // Grayscale
        if (grayscale) {
          const avg = 0.2989 * r + 0.587 * g + 0.114 * b;
          r = g = b = avg;
        }

        // Sepia
        if (sepia) {
          const sr = 0.393 * r + 0.769 * g + 0.189 * b;
          const sg = 0.349 * r + 0.686 * g + 0.168 * b;
          const sb = 0.272 * r + 0.534 * g + 0.131 * b;
          r = sr; g = sg; b = sb;
        }

        // Invert
        if (invert) {
          r = 255 - r; g = 255 - g; b = 255 - b;
        }

        pixels[i] = Math.max(0, Math.min(255, r));
        pixels[i + 1] = Math.max(0, Math.min(255, g));
        pixels[i + 2] = Math.max(0, Math.min(255, b));
      }

      ctx.putImageData(imageDataObj, 0, 0);
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      const buffer = await blob.arrayBuffer();

      self.postMessage({
        success: true,
        data: buffer,
        width: canvas.width,
        height: canvas.height,
        size: buffer.byteLength,
        format: 'image/png',
      }, [buffer]);
    }

  } catch (err) {
    self.postMessage({ success: false, error: err.message });
  }
};