import { useEffect, useRef, useState } from 'react';
import { Layout } from '../components/Layout';
import {
  VStack, Heading, Input, Button, Text, HStack, useToast, Divider,
  Alert, AlertIcon, RadioGroup, Radio, Stack, Badge, Spinner
} from '@chakra-ui/react';
import { credentialsLogin, otpGenerate, otpVerifyEmail } from '../lib/auth';
import { prettyError } from '../lib/errors';

async function resolveMasked(masked: string[]): Promise<Record<string,string|null>> {
  const res = await fetch('/api/auth/line-map/resolve', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    credentials: 'include',
    body: JSON.stringify({ masked }),
  });
  if (!res.ok) return {};
  const j = await res.json();
  return j?.map || {};
}

export default function LoginPage() {
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [otp, setOtp] = useState('');
  const [otpVia, setOtpVia] = useState<'email' | 'sms'>('email');

  const [customerLines, setCustomerLines] = useState<string[]>([]);
  const [selectedMasked, setSelectedMasked] = useState<string | null>(null);

  const [msisdnResolved, setMsisdnResolved] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  const [needsOtp, setNeedsOtp] = useState(false);
  const [otpRequested, setOtpRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [lastPayload, setLastPayload] = useState<any>(null);

  const [cooldown, setCooldown] = useState(0);
  const cdTimer = useRef<NodeJS.Timeout | null>(null);

  const startCooldown = (ms: number) => {
    const end = Date.now() + ms;
    if (cdTimer.current) clearInterval(cdTimer.current as any);
    setCooldown(Math.ceil(ms / 1000));
    cdTimer.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setCooldown(left);
      if (left <= 0 && cdTimer.current) {
        clearInterval(cdTimer.current as any);
        cdTimer.current = null;
      }
    }, 500);
  };

  useEffect(() => () => { if (cdTimer.current) clearInterval(cdTimer.current as any); }, []);

  useEffect(() => {
    (async () => {
      if (otpVia === 'sms' && selectedMasked) {
        setResolving(true);
        setMsisdnResolved(null);
        try {
          const map = await resolveMasked([selectedMasked]);
          setMsisdnResolved(map[selectedMasked] || null);
        } catch { setMsisdnResolved(null); }
        finally { setResolving(false); }
      } else {
        setMsisdnResolved(null);
      }
    })();
  }, [otpVia, selectedMasked]);

  async function handleCredentials() {
    setBusy(true); setStatus(null); setLastPayload(null); setCustomerLines([]); setSelectedMasked(null);
    try {
      const { ok, data } = await credentialsLogin(email, password);
      setLastPayload(data ?? null);
      const lines = data?.data?.customerLines ?? [];
      setCustomerLines(lines);
      setNeedsOtp(true);
      setStatus(lines.length ? 'Seleziona canale OTP e linea (SMS)' : 'Procedi con OTP via Email');
      if (lines.length) {
        toast({ title: 'Pre‑login OK', description: 'Scegli Email o SMS (seleziona linea)', status: 'info', duration: 2500, isClosable: true });
      }
    } catch (e: any) {
      setNeedsOtp(true);
      setStatus('Errore credenziali: prova OTP');
      toast({ title: 'Errore credenziali', description: e?.message || String(e), status: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function doGenerate() {
    const via = otpVia;
    const opts =
      via === 'sms'
        ? { via: 'sms' as const, selectedMasked, msisdn: msisdnResolved ?? undefined }
        : { via: 'email' as const };

    const { ok, data } = await otpGenerate(email, opts as any);
    setLastPayload(data ?? null);
    setOtpRequested(true); setNeedsOtp(true);

    const friendly = prettyError(data);
    if (ok) {
      setStatus(`OTP ${via.toUpperCase()} inviato`);
      startCooldown(60_000);
      toast({ title: `OTP via ${via} inviato`, status: 'success', duration: 2000, isClosable: true });
    } else {
      setStatus(friendly || 'Invio OTP fallito');
      toast({ title: 'Invio OTP fallito', description: friendly || (data ? JSON.stringify(data) : undefined), status: 'error', duration: 4000, isClosable: true });
      if (data?.retryInMs) startCooldown(Number(data.retryInMs));
    }
  }

  async function handleOtpGenerate() {
    setBusy(true); setStatus(null);
    try {
      await doGenerate();
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setBusy(true); setStatus(null);
    try {
      await doGenerate();
    } finally {
      setBusy(false);
    }
  }

  async function handleOtpVerify() {
    setBusy(true); setStatus(null); setLastPayload(null);
    try {
      const { ok, data } = await otpVerifyEmail(email, otp);
      setLastPayload(data ?? null);
      if (ok) {
        setStatus('Login completato');
        toast({ title: 'Login completato', status: 'success', duration: 1500, isClosable: true });
        setTimeout(() => { window.location.href = '/'; }, 300);
      } else {
        const friendly = prettyError(data);
        setStatus(friendly || 'Verifica OTP fallita');
        toast({ title: 'OTP errato', description: friendly || (data ? JSON.stringify(data) : undefined), status: 'error' });
      }
    } catch (e: any) {
      toast({ title: 'Errore verifica OTP', description: e?.message || String(e), status: 'error' });
    } finally {
      setBusy(false);
    }
  }

  const canUseEmail = email.trim().length > 0;
  const hasLines = customerLines.length > 0;

  return (
    <Layout>
      <VStack spacing={6} align="stretch">
        <Heading size="md">Login</Heading>

        <VStack align="stretch" spacing={3}>
          <Input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
          <HStack>
            <Button colorScheme="green" onClick={handleCredentials} isLoading={busy} isDisabled={!canUseEmail || !password}>
              Pre‑login (credentials)
            </Button>
          </HStack>

          {hasLines && (
            <VStack align="start" spacing={2}>
              <Text fontSize="sm" fontWeight="semibold">Linee disponibili (mascherate):</Text>
              <HStack wrap="wrap">
                {customerLines.map(l => (
                  <Badge key={l} colorScheme={selectedMasked === l ? 'green' : 'purple'} onClick={() => setSelectedMasked(l)} cursor="pointer">
                    {l}
                  </Badge>
                ))}
              </HStack>
              {!selectedMasked && <Text fontSize="xs" color="gray.600">Seleziona una linea per OTP via SMS.</Text>}
            </VStack>
          )}
        </VStack>

        {needsOtp && (
          <VStack align="stretch" spacing={4}>
            <Divider />
            <Heading size="sm">Richiedi OTP</Heading>
            <RadioGroup value={otpVia} onChange={v => setOtpVia(v as 'email' | 'sms')}>
              <Stack direction="row" spacing={6}>
                <Radio value="email">Email</Radio>
                <Radio value="sms" isDisabled={!hasLines}>SMS</Radio>
              </Stack>
            </RadioGroup>

            {otpVia === 'sms' && hasLines && selectedMasked && (
              <HStack>
                <Text fontSize="sm">Linea selezionata: {selectedMasked}</Text>
                {resolving && <Spinner size="xs" />}
                {msisdnResolved && <Text fontSize="sm" color="green.600">Risolta (ultime 4 cifre corrispondono).</Text>}
                {!msisdnResolved && !resolving && <Text fontSize="sm" color="gray.600">Fallback: invio usando la maschera.</Text>}
              </HStack>
            )}

            <HStack>
              <Button
                variant="outline"
                onClick={handleOtpGenerate}
                isLoading={busy}
                isDisabled={
                  !canUseEmail ||
                  (otpVia === 'sms' && !selectedMasked) ||
                  cooldown > 0
                }
              >
                Invia OTP
              </Button>
              <Button
                onClick={handleResend}
                isLoading={busy}
                isDisabled={!otpRequested || cooldown > 0}
              >
                Reinvia OTP {cooldown > 0 ? `(${cooldown}s)` : ''}
              </Button>
            </HStack>
            <Text fontSize="xs" color="gray.500">Puoi reinviare il codice ogni 60 secondi.</Text>
          </VStack>
        )}

        {(otpRequested || needsOtp) && (
          <VStack align="stretch" spacing={3}>
            <Divider />
            <Heading size="sm">Verifica OTP</Heading>
            <Input placeholder="OTP ricevuto" value={otp} onChange={e => setOtp(e.target.value)} />
            <Button colorScheme="blue" onClick={handleOtpVerify} isLoading={busy} isDisabled={!canUseEmail || otp.trim().length === 0}>
              Verifica e completa login
            </Button>
          </VStack>
        )}

        {status && (
          <Alert status="info" borderRadius="md"><AlertIcon /> {status}</Alert>
        )}

        {lastPayload && (
          <VStack align="start" spacing={2}>
            <Heading size="xs">Payload risposta</Heading>
            <pre style={{ whiteSpace:'pre-wrap', fontSize:12, background:'#f7fafc', padding:12, borderRadius:8 }}>
{JSON.stringify(lastPayload, null, 2)}
            </pre>
          </VStack>
        )}
      </VStack>
    </Layout>
  );
}