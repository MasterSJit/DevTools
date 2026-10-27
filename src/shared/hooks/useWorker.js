import { useEffect, useRef, useCallback } from 'react';

export function useWorker(workerPath) {
  const workerRef = useRef(null);
  const callbacksRef = useRef([]);

  useEffect(() => {
    workerRef.current = new Worker(new URL(workerPath, import.meta.url), { type: 'module' });
    workerRef.current.onmessage = (e) => {
      callbacksRef.current.forEach((cb) => cb(e));
    };
    return () => { workerRef.current?.terminate(); };
  }, [workerPath]);

  const postMessage = useCallback((data, transfer) => {
    workerRef.current?.postMessage(data, transfer);
  }, []);

  const onMessage = useCallback((callback) => {
    callbacksRef.current.push(callback);
    return () => {
      callbacksRef.current = callbacksRef.current.filter((cb) => cb !== callback);
    };
  }, []);

  return { postMessage, onMessage };
}