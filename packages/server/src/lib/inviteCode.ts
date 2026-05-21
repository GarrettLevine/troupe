import { nanoid } from 'nanoid';

export const generateInviteCode = (): string => nanoid(10);
