import { renderHook, waitFor } from '@testing-library/react-native';
import type { AppRuntime } from '../../di/bootstrap';
import type { Identity } from '../../services/identity';
import { useBootstrapViewModel } from '../useBootstrapViewModel';

const IDENTITY: Identity = {
  shop: { id: 'shop-1', name: 'Gupta Hardware', address: null, phone: null, gstin: null, invoicePrefix: 'GH' },
  device: { id: 'device-1', letter: 'A' },
};

/** Just enough runtime for the hook: it only reaches for the identity service. */
const runtimeWith = (identity: Identity | null): AppRuntime =>
  ({
    db: {},
    platform: { identityService: { load: async () => identity } },
  }) as unknown as AppRuntime;

const HOLD = 120;

describe('holding the launch screen', () => {
  /**
   * Unlocking is well under a second on a warm install, which left the shop
   * name on screen for a frame or two. Without the hold this assertion passes
   * only by accident.
   */
  it('is still showing the launch screen after an instant start-up', async () => {
    const { result } = await renderHook(() =>
      useBootstrapViewModel(async () => runtimeWith(IDENTITY), HOLD),
    );

    await waitFor(() => expect(result.current).toBeTruthy());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.identity).toBeNull();
  });

  it('opens the app once the hold has passed', async () => {
    const { result } = await renderHook(() =>
      useBootstrapViewModel(async () => runtimeWith(IDENTITY), HOLD),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    expect(result.current.identity).toEqual(IDENTITY);
    expect(result.current.error).toBeNull();
  });

  it('goes to setup rather than the app when the install has no shop yet', async () => {
    const { result } = await renderHook(() =>
      useBootstrapViewModel(async () => runtimeWith(null), HOLD),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    expect(result.current.needsSetup).toBe(true);
    expect(result.current.identity).toBeNull();
  });

  /** A failed start behaves the same way, so the screen never flashes past. */
  it('holds a failed start-up too, then reports why', async () => {
    const { result } = await renderHook(() =>
      useBootstrapViewModel(async () => {
        throw new Error('database is locked');
      }, HOLD),
    );

    await waitFor(() => expect(result.current).toBeTruthy());
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    expect(result.current.error).toBe('database is locked');
    expect(result.current.runtime).toBeNull();
  });

  it('adds no delay of its own when start-up already took longer', async () => {
    const started = Date.now();
    const { result } = await renderHook(() =>
      useBootstrapViewModel(async () => {
        await new Promise((r) => setTimeout(r, HOLD * 2));
        return runtimeWith(IDENTITY);
      }, HOLD),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 });
    // Comfortably under start-up plus another full hold, which is what a
    // blanket wait rather than a floor would have cost.
    expect(Date.now() - started).toBeLessThan(HOLD * 3);
  });
});
