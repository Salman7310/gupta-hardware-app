import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppRuntime } from '../di/bootstrap';
import { Identity, ShopSetupInput } from '../services/identity';

type BootstrapState =
  | { readonly status: 'loading' }
  | { readonly status: 'needsSetup'; readonly runtime: AppRuntime }
  | { readonly status: 'ready'; readonly runtime: AppRuntime; readonly identity: Identity }
  | { readonly status: 'error'; readonly message: string };

export interface BootstrapViewModel {
  readonly isLoading: boolean;
  readonly needsSetup: boolean;
  readonly runtime: AppRuntime | null;
  readonly identity: Identity | null;
  readonly error: string | null;
  readonly isSubmitting: boolean;
  submit(input: ShopSetupInput): Promise<void>;
  /**
   * Re-reads the shop after its details are edited, which rebuilds the
   * container so the name on the next bill is the new one.
   */
  reloadIdentity(): Promise<void>;
}

const messageOf = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/**
 * How long the launch screen stays up, however quickly the database opens.
 *
 * Unlocking takes well under a second on a warm install, which left the shop
 * name on screen for a frame or two: long enough to flicker, not long enough
 * to read. This holds the screen so start-up reads as the shop's app opening
 * rather than as a green flash.
 */
export const MINIMUM_LAUNCH_MS = 3500;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Waits out whatever is left of the minimum, and nothing if it has passed. */
async function holdUntilReadable(startedAt: number, minimumMs: number): Promise<void> {
  const remaining = minimumMs - (Date.now() - startedAt);
  if (remaining > 0) await wait(remaining);
}

/**
 * Drives the whole start-up sequence: open the encrypted database, migrate it,
 * then find out whether this install has been set up.
 *
 * Nothing may be written before the shop and device identity exist, because
 * every row carries both and rows saved under a placeholder would need
 * migrating later.
 */
export function useBootstrapViewModel(
  bootstrap: () => Promise<AppRuntime>,
  minimumLaunchMs: number = MINIMUM_LAUNCH_MS,
): BootstrapViewModel {
  const [state, setState] = useState<BootstrapState>({ status: 'loading' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const startedAt = Date.now();

    const run = async () => {
      try {
        const runtime = await bootstrap();
        const identity = await runtime.platform.identityService.load();
        if (cancelled) return;
        // The hold applies to a failed start too, so the screen behaves the
        // same way every time rather than flashing past only when something
        // has gone wrong.
        await holdUntilReadable(startedAt, minimumLaunchMs);
        if (cancelled) return;
        setState(
          identity ? { status: 'ready', runtime, identity } : { status: 'needsSetup', runtime },
        );
      } catch (e) {
        const message = messageOf(e, 'Could not start the app');
        await holdUntilReadable(startedAt, minimumLaunchMs);
        if (!cancelled) setState({ status: 'error', message });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [bootstrap, minimumLaunchMs]);

  const runtime = state.status === 'needsSetup' || state.status === 'ready' ? state.runtime : null;

  const submit = useCallback(
    async (input: ShopSetupInput) => {
      if (!runtime) return;
      setIsSubmitting(true);
      try {
        const result = await runtime.platform.identityService.register(input);
        if (result.ok) {
          setSubmitError(null);
          setState({ status: 'ready', runtime, identity: result.value });
        } else {
          setSubmitError(result.error.message);
        }
      } catch (e) {
        setSubmitError(messageOf(e, 'Could not save shop settings'));
      } finally {
        setIsSubmitting(false);
      }
    },
    [runtime],
  );

  const reloadIdentity = useCallback(async () => {
    if (!runtime) return;
    const identity = await runtime.platform.identityService.load();
    if (identity) setState({ status: 'ready', runtime, identity });
  }, [runtime]);

  return useMemo(
    () => ({
      isLoading: state.status === 'loading',
      needsSetup: state.status === 'needsSetup',
      runtime,
      identity: state.status === 'ready' ? state.identity : null,
      error: state.status === 'error' ? state.message : submitError,
      isSubmitting,
      submit,
      reloadIdentity,
    }),
    [state, runtime, submitError, isSubmitting, submit, reloadIdentity],
  );
}
