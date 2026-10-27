import { useState, useCallback } from 'react';

export function useFileReader() {
  const [file, setFile] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const read = useCallback((fileObj, type = 'text') => {
    setFile(fileObj);
    setLoading(true);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => { setData(reader.result); setLoading(false); resolve(reader.result); };
      reader.onerror = (err) => { setLoading(false); reject(err); };
      if (type === 'text') reader.readAsText(fileObj);
      else if (type === 'dataURL') reader.readAsDataURL(fileObj);
      else if (type === 'arrayBuffer') reader.readAsArrayBuffer(fileObj);
    });
  }, []);

  const reset = useCallback(() => { setFile(null); setData(null); setLoading(false); }, []);

  return { file, data, loading, read, reset, setData };
}