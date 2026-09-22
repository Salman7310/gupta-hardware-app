import { newId } from '../core';
import { IdentityService } from '../services/identity';
import {
  Clock,
  IdGenerator,
  SecureKeyStore,
  SettingsRepository,
  systemClock,
} from '../services/ports';
import type { Database } from '../data/db/client';
import { DrizzleSettingsRepository } from '../data/repositories/settings.repository';

/**
 * Services available before we know which shop this is.
 *
 * First-run setup needs settings and secure storage in order to establish the
 * shop and device identity, so those cannot live in the main container, which
 * is scoped to an identity that does not exist yet.
 */
export interface PlatformServices {
  readonly settings: SettingsRepository;
  readonly secure: SecureKeyStore;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  readonly identityService: IdentityService;
}

export function createPlatformServices(db: Database, secure: SecureKeyStore): PlatformServices {
  const settings = new DrizzleSettingsRepository(db);
  const ids: IdGenerator = { next: newId };

  return {
    settings,
    secure,
    ids,
    clock: systemClock,
    identityService: new IdentityService(settings, secure, ids),
  };
}
