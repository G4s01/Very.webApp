import { useState } from 'react';
import {
  Container, Box, Heading, Text, Input, Button, VStack, Alert, AlertIcon,
} from '@chakra-ui/react';

export default function RecoverPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function handleRecover() {
    setLoading(true); setErr(null); setMsg(null);
    try {
      const r = await fetch('/api/auth/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || data?.message || 'Errore');
      setMsg('Email inviata! Controlla la casella per le istruzioni di reimpostazione.');
    } catch (e: any) {
      setErr(e.message || 'Errore');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container maxW="md" py={10}>
      <VStack spacing={6}>
        <Heading size="lg">Recupera Password</Heading>
        <Text>Inserisci la tua email Very. Riceverai istruzioni per reimpostare la password.</Text>
        {msg && <Alert status="success"><AlertIcon />{msg}</Alert>}
        {err && <Alert status="error"><AlertIcon />{err}</Alert>}
        <Box borderWidth="1px" borderRadius="md" p={4}>
          <VStack spacing={4}>
            <Input
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              isDisabled={loading}
            />
            <Button
              colorScheme="blue"
              onClick={handleRecover}
              isDisabled={loading || !email}
            >
              Recupera Password
            </Button>
          </VStack>
        </Box>
      </VStack>
    </Container>
  );
}