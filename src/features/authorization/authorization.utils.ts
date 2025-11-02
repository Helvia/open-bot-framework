import * as crypto from 'crypto';

export class AuthorizationUtils {
    static generateRandom(length: number) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-~';
        const bytes = crypto.randomBytes(length);
        return Array.from(bytes)
            .map(b => chars[b % chars.length])
            .join('');
    }

    static createHash(payload: string): string {
        return crypto.createHash('sha256').update(payload).digest('hex');
    }
}
