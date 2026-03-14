'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface NavVisibilityContextValue {
  navHidden: boolean;
  setNavHidden: (hidden: boolean) => void;
}

const NavVisibilityContext = createContext<NavVisibilityContextValue>({
  navHidden: false,
  setNavHidden: () => {},
});

export function NavVisibilityProvider({ children }: { children: ReactNode }) {
  const [navHidden, setNavHiddenState] = useState(false);
  const setNavHidden = useCallback((hidden: boolean) => setNavHiddenState(hidden), []);
  return (
    <NavVisibilityContext.Provider value={{ navHidden, setNavHidden }}>
      {children}
    </NavVisibilityContext.Provider>
  );
}

export function useNavVisibility() {
  return useContext(NavVisibilityContext);
}
