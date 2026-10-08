import { ReviewScreen } from "@/components/game/ReviewScreen";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReviewScreen key={id} id={id} />;
}
