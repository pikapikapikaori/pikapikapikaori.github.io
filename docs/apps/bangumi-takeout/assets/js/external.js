const externalBase = new URL('../external/js/', import.meta.url)

let loaded = null
let loading = null

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

export function getExternal() {
    if (!loaded) throw new Error('外部模块尚未加载')
    return loaded
}
