"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Activity, Settings, LogOut } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { signOut } from "@/lib/auth.client";
import { useRouter } from "next/navigation";

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
}

const navItems: NavItem[] = [
  { href: "/inbox", icon: MessageSquare, label: "Inbox" },
  { href: "/activity", icon: Activity, label: "Control Tower" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
      <nav
        className="flex h-full w-[60px] flex-col items-center bg-slate-900 py-4"
        aria-label="Main navigation"
      >
        {/* Logo/Brand area - clickable, navigates to Inbox */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/inbox"
              className={`mb-8 flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-200 ${
                pathname.startsWith("/inbox")
                  ? "bg-emerald-600 text-white"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              }`}
              aria-label="Inbox"
            >
              <MessageSquare className="h-5 w-5" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            Inbox
          </TooltipContent>
        </Tooltip>

        {/* Navigation items */}
        <div className="flex flex-1 flex-col items-center gap-2">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={`
                      group flex h-10 w-10 items-center justify-center rounded-lg
                      transition-all duration-200
                      ${isActive
                        ? "bg-slate-700 text-emerald-400"
                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                      }
                    `}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="sr-only">{item.label}</span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Sign out button at bottom */}
        <div className="mt-auto">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleSignOut}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-all duration-200 hover:bg-slate-800 hover:text-red-400"
                aria-label="Sign out"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={10}>
              Sign Out
            </TooltipContent>
          </Tooltip>
        </div>
      </nav>
    </TooltipProvider>
  );
}
