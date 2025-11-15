import { Button } from '@chakra-ui/react';
import { logout } from '../lib/auth';
import { useState } from 'react';

export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      isLoading={busy}
      onClick={async () => {
        setBusy(true);
        await logout();
        setBusy(false);
        window.location.href = '/login';
      }}
    >
      Logout
    </Button>
  );
}