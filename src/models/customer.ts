import { Id } from '../core';

export interface Customer {
  readonly id: Id;
  readonly shopId: Id;
  readonly name: string;
  readonly phone: string | null;
  readonly address: string | null;
  readonly gstin: string | null;
  readonly updatedAt: number;
}
