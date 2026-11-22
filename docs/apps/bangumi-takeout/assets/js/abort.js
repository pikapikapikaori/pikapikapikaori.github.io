const abortMessage = '__ABORTED__'

export function abortError() {
    const error = new Error(abortMessage)
    error.name = 'AbortedError'
    return error
}

export function isAbortError(error) {
    return !!error && (error.name === 'AbortedError'
        || error.name === 'AbortError'
        || error.message === abortMessage)
}
