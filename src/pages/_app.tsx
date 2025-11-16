import { ChakraProvider } from '@chakra-ui/react';
import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LineProvider } from '../hooks/useLineContext';

const queryClient = new QueryClient();

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ChakraProvider>
      <QueryClientProvider client={queryClient}>
        <LineProvider>
          <Component {...pageProps} />
        </LineProvider>
      </QueryClientProvider>
    </ChakraProvider>
  );
}