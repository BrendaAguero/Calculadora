import { StaffForm } from './staff-form';

export const metadata = { title: 'Ingreso', robots: { index: false, follow: false } };

export default async function StaffLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <StaffForm next={typeof next === 'string' ? next.slice(0, 200) : ''} />;
}
