import { ReactNode } from 'react';
import { Box, Container } from '@chakra-ui/react';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <Box minH="100vh" bg="gray.50" py={8}>
      <Container maxW="6xl">{children}</Container>
    </Box>
  );
}