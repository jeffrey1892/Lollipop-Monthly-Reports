import { LiveBoard } from "./LiveBoard";

export default async function LivePage({ searchParams }: { searchParams: Promise<{ display?: string }> }) {
  const { display } = await searchParams;
  return <LiveBoard projector={display === "projector"} />;
}
