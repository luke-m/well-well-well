export class OverpassError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'OverpassError';
    }
}
