import 'express-serve-static-core';
import type { AuthUser } from '../../../shared/dist/types';

declare module 'express-serve-static-core' {
    interface Request {
        userId: string;
        authUser?: AuthUser;
        authToken?: string;
    }
}
