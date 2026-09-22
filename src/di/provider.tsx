import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { AppContainer, createContainer } from './container';

const ContainerContext = createContext<AppContainer | null>(null);

/**
 * TODO (Sprint 1): read these from settings on first launch — the shop id when
 * the app is registered, the device id minted once and kept in secure storage.
 * The per-device id is what gives each counter its own invoice series.
 */
const BOOTSTRAP_SHOP_ID = 'shop-default';
const BOOTSTRAP_DEVICE_ID = 'device-a';

export function ContainerProvider({
  children,
  container,
}: {
  children: ReactNode;
  container?: AppContainer;
}) {
  const value = useMemo(
    () =>
      container ?? createContainer({ shopId: BOOTSTRAP_SHOP_ID, deviceId: BOOTSTRAP_DEVICE_ID }),
    [container],
  );
  return <ContainerContext.Provider value={value}>{children}</ContainerContext.Provider>;
}

/** Tests inject a container built from in-memory fakes through the provider. */
export function useContainer(): AppContainer {
  const container = useContext(ContainerContext);
  if (!container) throw new Error('useContainer must be used inside a ContainerProvider');
  return container;
}
