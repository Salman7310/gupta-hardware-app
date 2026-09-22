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
}

const messageOf = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/**
 * Drives the whole start-up sequence: open the encrypted database, migrate it,
 * then find out whether this install has been set up.
 *
 * Nothing may be written before the shop and device identity exist, because
 * every row carries both and rows saved under a placeholder would need
 * migrating later.
 */
export function useBootstrapViewModel(bootstrap: () => Promise<AppRuntime>): BootstrapViewModel {
  const [state, setState] = useState<BootstrapState>({ status: 'loading' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const runtime = await bootstrap();
        const identity = await runtime.platform.identityService.load();
        if (cancelled) return;
        setState(
          identity ? { status: 'ready', runtime, identity } : { status: 'needsSetup', runtime },
        );
      } catch (e) {
        if (!cancelled) {
          setState({ status: 'error', message: messageOf(e, 'Could not start the app') });
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [bootstrap]);

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

  return useMemo(
    () => ({
      isLoading: state.status === 'loading',
      needsSetup: state.status === 'needsSetup',
      runtime,
      identity: state.status === 'ready' ? state.identity : null,
      error: state.status === 'error' ? state.message : submitError,
      isSubmitting,
      submit,
    }),
    [state, runtime, submitError, isSubmitting, submit],
  );
}
