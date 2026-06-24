import { OAuth2Client, LoginTicket } from "google-auth-library";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const GOOGLE_ISSUERS = new Set([
    'https://accounts.google.com',
    'accounts.google.com',
]);

interface GoogleIdTokenPayload {
    sub: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
    iss: string;
    aud: string;
    azp?: string;
    exp: number;
    iat: number;
}

async function verifyIdToken(idToken: string): Promise<GoogleIdTokenPayload> {
    if (!process.env.GOOGLE_CLIENT_ID) {
        throw new Error('GOOGLE_CLIENT_ID must be set');
    }

    let ticket: LoginTicket;
    try {
        ticket = await client.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
    } catch (err: any) {
        throw new Error(`Google ID token verification failed: ${err.message}`);
    }

    const payload = ticket.getPayload() as GoogleIdTokenPayload | undefined;
    if (!payload) {
        throw new Error('Invalid Google ID token payload');
    }

    // Validate issuer — otherwise a token from a different Google app
    // (which might happen to share the client ID) would be accepted.
    if (!GOOGLE_ISSUERS.has(payload.iss)) {
        throw new Error(`Invalid Google ID token issuer: ${payload.iss}`);
    }

    // Belt-and-suspenders: re-validate the audience even though the
    // google-auth-library already does so.
    if (payload.aud !== process.env.GOOGLE_CLIENT_ID) {
        throw new Error('Invalid Google ID token audience');
    }

    if (payload.email && payload.email_verified === false) {
        throw new Error('Google email not verified');
    }

    return payload;
}

export { verifyIdToken, GoogleIdTokenPayload };
