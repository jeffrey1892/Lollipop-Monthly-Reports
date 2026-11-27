"use client";
import Image from "next/image";
import { usePathname } from "next/navigation";

/** HBS and YPO logos, shown at the very top of the sign-in and registration (home) pages. */
export function LogoStrip() {
  const path = usePathname();
  if (!/\/(login|register)$/.test(path)) return null;
  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-center gap-6 px-4 py-3 sm:gap-10">
        <Image src="/logos/hbs.jpg" alt="Harvard Business School" width={300} height={168} priority className="h-14 w-auto sm:h-16" />
        <span aria-hidden className="h-12 w-px bg-gray-200" />
        <Image src="/logos/ypo.jpg" alt="YPO" width={242} height={209} priority className="h-14 w-auto sm:h-16" />
      </div>
    </div>
  );
}
