import { createContext, useContext, useState, ReactNode, createElement } from 'react';
import { LineContext } from '../lib/types';

interface LineContextValue {
  context: LineContext;
  setContext: (c: LineContext) => void;
}

const Ctx = createContext<LineContextValue | undefined>(undefined);

export function LineProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<LineContext>({});
  // Niente JSX qui, così il file può restare .ts
  return createElement(Ctx.Provider, { value: { context, setContext } }, children);
}

export function useLineContext(): LineContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLineContext must be inside LineProvider');
  return v;
}