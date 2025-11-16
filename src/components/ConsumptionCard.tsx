import { Box, HStack, VStack, Text, Badge, Button } from '@chakra-ui/react';
import { formatGB, UsageData } from '../lib/usage';

type Props = {
  usage: UsageData;
  onTopup?: () => void;
};

function percent(used: number | null, total: number | null): number {
  if (used == null || total == null || total <= 0) return 0;
  return Math.min(100, Math.max(0, (used / total) * 100));
}

export function ConsumptionCard({ usage, onTopup }: Props) {
  const total = usage.data.totalBytes;
  const used = usage.data.usedBytes;
  const remaining = usage.data.remainingBytes;

  const pUsed = percent(used, total);
  const remainingGB = formatGB(remaining);
  const totalGB = formatGB(total);

  return (
    <VStack align="stretch" spacing={4} p={4} borderRadius="lg" bg="white" boxShadow="sm">
      <Text fontWeight="bold" color="green.700">IL TUO TOTALE</Text>

      <HStack align="center" spacing={6}>
        {/* Donut ring */}
        <Box
          position="relative"
          w="140px"
          h="140px"
          borderRadius="full"
          bg={`conic-gradient(#1A7F37 ${360 * (pUsed / 100)}deg, #E6F4EA 0deg)`}
        >
          <Box position="absolute" inset="10px" borderRadius="full" bg="white" />
          <VStack position="absolute" inset="0" align="center" justify="center" spacing={0}>
            <Text fontSize="3xl" fontWeight="bold">{remainingGB}</Text>
            <Text fontSize="xs" color="gray.600">Giga disponibili</Text>
            <Text fontSize="xs" color="gray.600">di {totalGB} totali</Text>
          </VStack>
        </Box>

        {/* Descrizione destra */}
        <VStack align="start" spacing={1} flex={1}>
          <Text fontSize="lg" color="green.700" fontWeight="semibold">
            Minuti e SMS {usage.minutes.unlimited && usage.sms.unlimited ? 'illimitati' : ''}
          </Text>
          {/* eventuali righe extra (consumi minuti/sms) */}
        </VStack>
      </HStack>

      {/* Opzioni attive */}
      {usage.options?.length > 0 && (
        <HStack spacing={3} wrap="wrap">
          {usage.options.map((opt, i) => (
            <Badge key={i} colorScheme="green" variant="subtle" px={3} py={1} borderRadius="full">
              {opt}
            </Badge>
          ))}
        </HStack>
      )}

      {/* Credito & Ricarica */}
      <HStack justify="space-between" mt={2}>
        <Text fontWeight="semibold">
          Credito residuo: {usage.credit.amount != null ? usage.credit.amount.toFixed(2) : '--'}€
        </Text>
        <Button size="sm" colorScheme="green" onClick={onTopup}>Ricarica</Button>
      </HStack>
    </VStack>
  );
}