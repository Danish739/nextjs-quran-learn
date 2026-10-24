import { Suspense } from 'react';
import DuaClient from './DuaClient';

export default function DuaPage() {
  return (
    <Suspense
      fallback={<div style={{ minHeight: '100vh' }} />}
    >
      <DuaClient />
    </Suspense>
  );
}