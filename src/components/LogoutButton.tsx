import { Button } from '@chakra-ui/react';

export default function LogoutButton() {
  const handle = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      window.location.replace('/login');
    }
  };
  return (
    <Button colorScheme="red" size="sm" onClick={handle}>
      Logout
    </Button>
  );
}