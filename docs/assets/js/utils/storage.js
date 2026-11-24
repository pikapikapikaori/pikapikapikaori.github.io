import { isNil } from './common.js'
import { storagePrefix } from './constants.js'

export const storageTypes = {
    local: 'local',
    session: 'session',
    none: 'none'
}

const probeKey = storagePrefix + 'storage-probe'

function normalizeStorageType(value) {
    return Object.values(storageTypes).includes(value) ? value : storageTypes.local
}

function openBrowserStorage(type) {
    try {
        const storage = type === storageTypes.session ? window.sessionStorage : window.localStorage

        storage.setItem(probeKey, probeKey)
        storage.removeItem(probeKey)

        return storage
    }
    catch {
        return null
    }
}

export function createStorage(type) {
    const storageType = normalizeStorageType(type)
    const browserStorage = storageType === storageTypes.none ? null : openBrowserStorage(storageType)
    const memory = new Map()

    function getItem(key) {
        if (!browserStorage) {
            const value = memory.get(key)

            return isNil(value) ? null : value
        }

        try {
            return browserStorage.getItem(key)
        }
        catch {
            return null
        }
    }

    function setItem(key, value) {
        const text = String(value)

        if (!browserStorage) {
            memory.set(key, text)

            return true
        }

        try {
            browserStorage.setItem(key, text)

            return true
        }
        catch {
            return false
        }
    }

    function removeItem(key) {
        if (!browserStorage) return memory.delete(key)

        try {
            browserStorage.removeItem(key)

            return true
        }
        catch {
            return false
        }
    }

    function getJSON(key, fallback = null) {
        const text = getItem(key)

        if (isNil(text)) return fallback

        try {
            return JSON.parse(text)
        }
        catch {
            return fallback
        }
    }

    function setJSON(key, value) {
        let text

        try {
            text = JSON.stringify(value)
        }
        catch {
            return false
        }

        if (isNil(text)) return false

        return setItem(key, text)
    }

    return {
        type: storageType,
        available: Boolean(browserStorage),
        getItem,
        setItem,
        removeItem,
        getJSON,
        setJSON
    }
}
