export class OverpassError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'OverpassError';
    }
}

export type GeolocationErrorCode =
    | 'PERMISSION_DENIED'
    | 'POSITION_UNAVAILABLE'
    | 'TIMEOUT'
    | 'UNSUPPORTED';

export class GeolocationError extends Error {
    readonly code: GeolocationErrorCode;

    constructor(message: string, code: GeolocationErrorCode) {
        super(message);
        this.name = 'GeolocationError';
        this.code = code;
    }
}
