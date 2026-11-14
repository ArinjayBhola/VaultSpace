import { Login } from '@/components/login';
export default function LoginPage() {
  return (
    <Login
      configured={Boolean(
        process.env.DATABASE_URL &&
        process.env.BETTER_AUTH_SECRET &&
        process.env.BETTER_AUTH_URL,
      )}
    />
  );
}
