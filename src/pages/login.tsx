import { useEffect, useState } from 'react';
import {
  Container, Box, Heading, Text, Input, Button, VStack,
  Alert, AlertIcon, HStack, Badge, Spinner, VisuallyHidden
} from '@chakra-ui/react';
import { prettyError } from '../lib/errors';
import { normalizeAuthError, formatAuthError } from '../lib/authErrors';

type Step = 'credentials' | 'choose' | 'awaitOtp' | 'done';
type Channel = 'email' | 'sms';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<Step>('credentials');
  const [channel, setChannel] = useState<Channel | null>(null);
  const [maskedLines, setMaskedLines] = useState<string[]>([]);
  const [selectedMasked, setSelectedMasked] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/auth/session', { credentials: 'include' });
        if (r.ok) window.location.href = '/';
      } catch {}
    })();
  }, []);

  function resetErrors() {
    setErr(null); setSuggestion(null); setErrorCode(null);
  }

  async function doCredentials() {
    setLoading(true); resetErrors(); setMsg(null);
    try {
      const r = await fetch('/api/auth/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: username.trim(), password, rememberMe: true })
      });
      const data = await r.json();
      if (!r.ok) {
        const norm = normalizeAuthError(data, r.status);
        setErr(formatAuthError(norm));
        setSuggestion(norm?.suggestion || null);
        setErrorCode(norm?.code || null);
        setStep('credentials');
        return;
      }
      // Non controlliamo più l'header; il challenge è in cookie httpOnly.
      const lines = Array.isArray(data?.data?.customerLines) ? data.data.customerLines : [];
      setMaskedLines(lines);
      setMsg('Credenziali OK. Scegli il canale per l’OTP.');
      setStep('choose');
      setChannel(null);
      setSelectedMasked('');
    } catch (e) {
      setErr(prettyError(e));
    } finally {
      setLoading(false);
    }
  }

  async function chooseEmail() {
    setChannel('email'); resetErrors(); setLoading(true); setMsg(null);
    try {
      const r = await fetch('/api/auth/otp-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: username.trim() })
      });
      const data = await r.json();
      if (!r.ok) {
        const norm = normalizeAuthError(data, r.status);
        setErr(formatAuthError(norm));
        setSuggestion(norm?.suggestion || null);
        setErrorCode(norm?.code || null);
        setChannel(null);
        return;
      }
      setMsg('OTP inviato via email/SMS principale. Inserisci il codice.');
      setStep('awaitOtp');
    } catch (e) {
      setErr(prettyError(e)); setChannel(null);
    } finally {
      setLoading(false);
    }
  }

  function chooseSms() { setChannel('sms'); resetErrors(); }

  async function sendSms(mask: string) {
    setSelectedMasked(mask); resetErrors(); setLoading(true); setMsg(null);
    try {
      const r = await fetch('/api/auth/otp-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: username.trim(), customerLine: mask })
      });
      const data = await r.json();
      if (!r.ok) {
        const norm = normalizeAuthError(data, r.status);
        setErr(formatAuthError(norm));
        setSuggestion(norm?.suggestion || null);
        setErrorCode(norm?.code || null);
        setSelectedMasked('');
        return;
      }
      setMsg(`OTP inviato via SMS a ${mask}. Inserisci il codice.`);
      setStep('awaitOtp');
    } catch (e) {
      setErr(prettyError(e));
      setSelectedMasked('');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setLoading(true); resetErrors(); setMsg(null);
    try {
      const r = await fetch('/api/auth/otp-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: username.trim(), otp: otp.trim() })
      });
      const data = await r.json();
      if (!r.ok) {
        const norm = normalizeAuthError(data, r.status);
        setErr(formatAuthError(norm));
        setSuggestion(norm?.suggestion || null);
        setErrorCode(norm?.code || null);
        return;
      }
      setMsg('Autenticazione completata. Reindirizzamento…');
      setStep('done');
      setTimeout(() => window.location.href = '/', 600);
    } catch (e) {
      setErr(prettyError(e));
    } finally { setLoading(false); }
  }

  return (
    <Container maxW="md" py={10}>
      <VisuallyHidden>
        <div aria-live="assertive">{err}</div>
        <div aria-live="polite">{msg}</div>
      </VisuallyHidden>

      <VStack align="stretch" spacing={6}>
        <Box>
          <Heading size="lg">Login Very</Heading>
          <Text fontSize="sm" color="gray.600">
            Credenziali → canale OTP → codice → accesso
          </Text>
        </Box>
        <HStack>
          <Badge colorScheme={step === 'credentials' ? 'blue' : 'gray'}>1. Credenziali</Badge>
          <Badge colorScheme={step === 'choose' ? 'blue' : 'gray'}>2. Canale</Badge>
          <Badge colorScheme={step === 'awaitOtp' ? 'blue' : 'gray'}>3. OTP</Badge>
        </HStack>

        {msg && <Alert status="success" role="status"><AlertIcon />{msg}</Alert>}
        {err && (
          <Alert status="error" role="alert">
            <AlertIcon />
            <Box>
              <Text fontWeight="semibold">{err}</Text>
              {suggestion && <Text mt={1} fontSize="sm">Suggerimento: {suggestion}</Text>}
              {errorCode && <Text mt={1} fontSize="xs" color="gray.500">Codice interno: {errorCode}</Text>}
            </Box>
          </Alert>
        )}

        <Box borderWidth="1px" borderRadius="md" p={4}>
          {step === 'credentials' && (
            <VStack spacing={4} align="stretch">
              <Input aria-label="Email o username" placeholder="Email / Username" value={username}
                onChange={e => setUsername(e.target.value)} autoComplete="username" disabled={loading} />
              <Input aria-label="Password" placeholder="Password" type="password" value={password}
                onChange={e => setPassword(e.target.value)} autoComplete="current-password" disabled={loading} />
              <Button colorScheme="blue" onClick={doCredentials} isDisabled={!username || !password || loading}>
                {loading ? <Spinner size="sm" mr={2} /> : null}
                Accedi
              </Button>
              <Text textAlign="center" fontSize="sm">
                <a href="/recover" style={{ color: '#3182ce', textDecoration: 'underline' }}>
                  Password dimenticata?
                </a>
              </Text>
            </VStack>
          )}

          {step === 'choose' && channel === null && (
            <VStack spacing={4} align="stretch">
              <Button colorScheme="blue" onClick={chooseEmail} isDisabled={loading} aria-label="Invia OTP via email">
                OTP via Email/SMS principale
              </Button>
              {maskedLines.length > 0 && (
                <Button colorScheme="green" variant="outline" onClick={() => { setChannel('sms'); resetErrors(); }}
                  isDisabled={loading} aria-label="Invia OTP via SMS su linea">
                  OTP via SMS su linea
                </Button>
              )}
            </VStack>
          )}

          {step === 'choose' && channel === 'sms' && (
            <VStack spacing={3} align="stretch">
              {maskedLines.map(m => (
                <Button key={m} onClick={() => sendSms(m)} isDisabled={loading} variant="outline"
                  aria-label={`Invia OTP al numero ${m}`}>
                  {loading && selectedMasked === m ? <Spinner size="sm" mr={2} /> : null}
                  {m}
                </Button>
              ))}
              <Button variant="ghost" size="sm" onClick={() => { setChannel(null); setSelectedMasked(''); setMsg(null); resetErrors(); }}>
                ← Indietro
              </Button>
            </VStack>
          )}

          {step === 'awaitOtp' && (
            <VStack spacing={4} align="stretch">
              <Text fontSize="sm" color="gray.600">
                Inserisci OTP {selectedMasked ? `via SMS su ${selectedMasked}` : 'via email/SMS principale'}:
              </Text>
              <HStack>
                <Input aria-label="Codice OTP" placeholder="Codice OTP" value={otp}
                  onChange={e => setOtp(e.target.value)} inputMode="numeric" autoComplete="one-time-code" disabled={loading} />
                <Button colorScheme="green" onClick={verifyOtp} isDisabled={!otp || loading} aria-label="Verifica OTP">
                  {loading ? <Spinner size="sm" mr={2} /> : null}
                  Verifica
                </Button>
              </HStack>
              <Button variant="ghost" size="sm" onClick={() => { setOtp(''); setChannel(null); setSelectedMasked(''); setStep('choose'); setMsg('Scegli di nuovo il canale per inviare un nuovo OTP.'); resetErrors(); }}>
                ↻ Cambia canale / reinvia OTP
              </Button>
            </VStack>
          )}

          {step === 'done' && (
            <VStack><Text>Autenticazione completata. Reindirizzamento…</Text></VStack>
          )}
        </Box>
      </VStack>
    </Container>
  );
}