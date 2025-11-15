import { useState } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Button, Text, Input, VStack, Alert, AlertIcon
} from '@chakra-ui/react';
import { WARN_SECONDS } from '../lib/config';

type Props = {
  remainingSec: number;
  isOpen: boolean;
  onClose: () => void;
  onRechallenge: (password: string) => Promise<void>;
  onLogout: () => void;
};

export function SessionExpiryModal({
  remainingSec,
  isOpen,
  onClose,
  onRechallenge,
  onLogout
}: Props) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExtend() {
    setBusy(true); setError(null);
    try {
      await onRechallenge(password);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Re‑challenge fallito');
    } finally {
      setBusy(false);
    }
  }

  const warnText = remainingSec > 0
    ? `La sessione scade tra circa ${Math.floor(remainingSec / 60)} min ${remainingSec % 60}s`
    : 'Sessione scaduta, è necessario riloggare.';

  return (
    <Modal isOpen={isOpen} onClose={() => { if (!busy) onClose(); }} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Sessione in scadenza</ModalHeader>
        <ModalBody>
          <VStack align="stretch" spacing={4}>
            <Text fontSize="sm">{warnText}</Text>
            {remainingSec <= 0 && (
              <Alert status="warning">
                <AlertIcon /> Sessione scaduta. Effettua nuovamente il login.
              </Alert>
            )}
            {remainingSec > 0 && (
              <>
                <Text fontSize="sm">
                  Inserisci la password per estendere la sessione (re‑challenge).
                </Text>
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={busy}
                />
              </>
            )}
            {error && (
              <Alert status="error">
                <AlertIcon /> {error}
              </Alert>
            )}
            <Text fontSize="xs" color="gray.500">
              Soglia di avviso: {WARN_SECONDS / 60} minuti prima della scadenza.
            </Text>
          </VStack>
        </ModalBody>
        <ModalFooter gap={3}>
          {remainingSec > 0 && (
            <Button
              colorScheme="blue"
              onClick={handleExtend}
              isLoading={busy}
              disabled={!password}
            >
              Estendi
            </Button>
          )}
          <Button variant="outline" onClick={onLogout} isDisabled={busy}>
            Logout
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}