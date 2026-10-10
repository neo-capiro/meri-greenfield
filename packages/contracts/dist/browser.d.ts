import type { UIEvent } from './contracts.js';
export declare const validateUIEvent: ((value: unknown) => value is UIEvent) & { errors?: readonly unknown[] | null };
