import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { LearnStrip } from "@/components/landing/LearnStrip";
import { QuickPlay } from "@/components/landing/QuickPlay";
import { RecentGames } from "@/components/landing/RecentGames";

export default function HomePage() {
  return (
    <>
      <Hero />
      <QuickPlay />
      <LearnStrip />
      <RecentGames />
      <Footer />
    </>
  );
}
