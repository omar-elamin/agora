import type { Metadata } from "next";
import { guides } from "../content";
import GuidePageClient from "./GuidePageClient";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = guides[slug];

  if (!guide) {
    return { title: "Guide Not Found | Agora" };
  }

  const title = `${guide.title} Voice + Agora Speaker Locale Integration Guide`;

  return {
    title,
    description: guide.description,
    openGraph: {
      title,
      description: guide.description,
    },
  };
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  return <GuidePageClient slug={slug} />;
}
