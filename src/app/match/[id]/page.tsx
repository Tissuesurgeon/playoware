import { OnlineMatch } from "@/components/online/OnlineMatch";

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OnlineMatch key={id} id={id} />;
}
