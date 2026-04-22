import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PlanetProfile from "@/components/communities/PlanetProfile";

export default async function CommunityPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const collectiveId = resolvedParams.id;

  // --- THE DISPATCHER ---
  if (collectiveId === "planet") {
    return <PlanetProfile />;
  }

  // Fallback 404
  return (
    <div className="min-h-screen bg-[#0B0B0D] text-[#FFFFFF] flex flex-col items-center justify-center font-sans p-6">
      <h1 className="font-black text-6xl uppercase tracking-tighter mb-4 text-[#F53D04]">404</h1>
      <p className="font-mono text-xs uppercase tracking-widest mb-8 text-[#B3B3B8]">Profile Not Found</p>
      <Link href="/communities" className="px-6 py-3 border border-[#2A2A2E] hover:bg-[#FFFFFF] hover:text-[#0B0B0D] transition-colors font-bold uppercase text-xs flex items-center gap-2">
        <ArrowLeft size={16} /> Return to Directory
      </Link>
    </div>
  );
}