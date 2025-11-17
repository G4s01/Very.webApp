import '../styles/home.css'; // stile della nuova home e componenti

import type { AppProps } from 'next/app';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { LineProvider } from '../hooks/useLineContext';

// Modal opzionale: avviso sessione in scadenza/scaduta (puoi rimuoverlo se non ti serve globale)
import SessionExpiryModal from '../components/SessionExpiryModal';

// React Query client con default sensati per UI
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 60_000, // 1 minuto
    },
    mutations: {
      retry: 0,
    },
  },
});

// Tema Chakra minimale con colore brand Very
const theme = extendTheme({
  colors: {
    brand: {
      500: '#0a5d36',
      600: '#0a5d36',
    },
  },
  components: {
    Button: {
      variants: {
        solid: {
          bg: 'brand.500',
          color: 'white',
          _hover: { bg: 'brand.600' },
          _disabled: { opacity: 0.6, cursor: 'not-allowed' },
        },
      },
    },
  },
  styles: {
    global: {
      'html, body': {
        bg: '#f4f7f5',
      },
    },
  },
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ChakraProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <LineProvider>
          {/* Modal globale per scadenza sessione (mostra avviso e azioni). 
              Se preferisci gestirlo pagina per pagina, rimuovi questa riga. */}
          <SessionExpiryModal warnAtSec={120} pollMs={10_000} />

          <Component {...pageProps} />

          {process.env.NODE_ENV !== 'production' && (
            <ReactQueryDevtools initialIsOpen={false} />
          )}
        </LineProvider>
      </QueryClientProvider>
    </ChakraProvider>
  );
}