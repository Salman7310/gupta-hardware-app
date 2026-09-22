import { ulid } from 'ulid';

/**
 * Identifiers are ULIDs, not auto-incrementing integers. Two devices billing
 * offline would both mint id 47 and one would overwrite the other on merge.
 * ULIDs also sort by creation time, so they still index well.
 */
export type Id = string;

export const newId = (): Id => ulid();
