const abortMessage = '__ABORTED__'

export function createAbortError(message = abortMessage, name = 'AbortedError') {
    const error = new Error(message)
    error.name = name
    return error
}

export function abortError() {
    return createAbortError()
}

export function isAbortError(error) {
    return !!error && (error.name === 'AbortedError'
        || error.name === 'AbortError'
        || error.message === abortMessage)
}
