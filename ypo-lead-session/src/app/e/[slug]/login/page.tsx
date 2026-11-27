import { LoginForm } from "./LoginForm";

export default async function LoginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <div className="card">
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="mt-1 text-gray-600">Enter the email you registered with. No password needed.</p>
        <LoginForm slug={slug} />
      </div>
      <p className="mt-4 text-center text-sm text-gray-600">
        Not registered yet?{" "}
        <a className="font-semibold text-crimson underline" href={`/e/${slug}/register`}>
          Register here
        </a>
      </p>
    </main>
  );
}
