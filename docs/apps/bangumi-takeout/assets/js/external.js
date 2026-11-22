const externalBase = new URL('../external/js/', import.meta.url)

let loaded = null
let loading = null

// Project code never imports assets/external statically; this is the only entry.
export function loadExternal({ storagePrefix = '' } = {}) {
    if (loaded) return Promise.resolve(loaded)
    if (!loading) {
        loading = import(new URL('index.js', externalBase).href)
            .then(module => {
                module.configureExternal({ storagePrefix })
                loaded = module
                return module
            })
            .catch(error => {
                loading = null
                throw error
            })
    }
    return loading
}

// Storage merges run inside an IndexedDB transaction and cannot await, so the
// module is loaded at boot and read synchronously afterwards.
export function getExternal() {
    if (!loaded) throw new Error('外部模块尚未加载')
    return loaded
}
