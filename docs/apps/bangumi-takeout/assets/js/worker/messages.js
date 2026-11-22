export function postServiceWorkerMessage(type, payload = {}) {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return
    const message = { type, ...payload }
    const send = worker => {
        try {
            worker?.postMessage(message)
        } catch { /* a replaced worker must not break the backup */ }
    }
    if (navigator.serviceWorker.controller) {
        send(navigator.serviceWorker.controller)
        return
    }
    navigator.serviceWorker.ready.then(registration => send(registration.active)).catch(() => {})
}
