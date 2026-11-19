// Thin client for image.worker.js. A newer request cancels an in-flight one by restarting the worker
// (WASM encoders can't be interrupted), the same strategy Squoosh uses.

let worker = null;
let seq = 0;
let pending = null; // { id, resolve, reject }

function spawn() {
  worker = new Worker(new URL('./image.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    if (!pending || data.id !== pending.id) return;
    const p = pending; pending = null;
    if (data.error) p.reject(new Error(data.error)); else p.resolve(data);
  };
  worker.onerror = (e) => {
    if (pending) { const p = pending; pending = null; p.reject(new Error(e.message || 'Worker crashed')); }
    worker?.terminate(); worker = null;
  };
}

export class Cancelled extends Error { constructor() { super('cancelled'); this.name = 'Cancelled'; } }

/** Encode ImageData in the worker. Returns { blob, width, height, ms }. */
export function encodeImage(imageData, { format, mime, options, resize }) {
  if (pending) { // abort the running job
    pending.reject(new Cancelled()); pending = null;
    worker?.terminate(); worker = null;
  }
  if (!worker) spawn();
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending = { id, resolve: (d) => resolve({ blob: new Blob([d.buffer], { type: mime }), width: d.width, height: d.height, ms: d.ms }), reject };
    worker.postMessage({ id, imageData, format, options, resize }, [imageData.data.buffer]);
  });
}

/** Run one job on a dedicated worker (batch mode) without cancelling the editor's job. */
export function encodeOnce(imageData, { format, mime, options, resize }) {
  const w = new Worker(new URL('./image.worker.js', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    w.onmessage = ({ data }) => {
      w.terminate();
      if (data.error) reject(new Error(data.error));
      else resolve({ blob: new Blob([data.buffer], { type: mime }), width: data.width, height: data.height, ms: data.ms });
    };
    w.onerror = (e) => { w.terminate(); reject(new Error(e.message || 'Worker crashed')); };
    w.postMessage({ id: 1, imageData, format, options, resize }, [imageData.data.buffer]);
  });
}
