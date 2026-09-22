import React, { createContext, useContext, type ReactNode } from 'react';
// Type-only: importing the value would pull the whole data layer into any test
// that renders a ViewModel, which is exactly what the fakes exist to avoid.
import type { AppContainer } from './container';

const ContainerContext = createContext<AppContainer | null>(null);

export function ContainerProvider({
  children,
  container,
}: {
  children: ReactNode;
  container: AppContainer;
}) {
  return <ContainerContext.Provider value={container}>{children}</ContainerContext.Provider>;
}

export function useContainer(): AppContainer {
  const container = useContext(ContainerContext);
  if (!container) throw new Error('useContainer must be used inside a ContainerProvider');
  return container;
}
