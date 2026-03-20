import { ClientGame } from '@/components/ClientGame';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center py-8 lg:pt-16 pb-20 lg:pb-8 crt">
      <ClientGame />
    </main>
  );
}
