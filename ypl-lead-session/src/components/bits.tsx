"use client";
import type { Category } from "@/lib/types";
import { categoryLabel } from "@/lib/types";

const CAT_STYLE: Record<Category, string> = {
  professional_services: "bg-blue-50 text-blue-800 ring-1 ring-blue-200",
  fundraising: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
  other: "bg-gray-100 text-gray-800 ring-1 ring-gray-200",
};

export function CategoryBadge({ category }: { category: Category }) {
  return <span className={`badge ${CAT_STYLE[category]}`}>{categoryLabel(category)}</span>;
}

export function StrengthPill({ strength }: { strength: number | null }) {
  if (strength === null) return <span className="badge bg-gray-100 text-gray-600">not rated</span>;
  const tone = strength >= 4 ? "bg-green-100 text-green-800" : strength === 3 ? "bg-amber-100 text-amber-800" : "bg-orange-100 text-orange-800";
  return <span className={`badge ${tone}`}>{strength}/5</span>;
}
