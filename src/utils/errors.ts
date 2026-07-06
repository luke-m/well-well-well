export class OverpassError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'OverpassError';
    }
}

export class ApiError extends Error {
    constructor(message: string, public statusCode?: number) {
        super(message);
        this.name = 'ApiError';
    }
}