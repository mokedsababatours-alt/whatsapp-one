import { Navigation } from "@/components/layout/Navigation";

export default function ViewsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-white">
      {/* Left Rail - Navigation */}
      <aside className="flex-shrink-0">
        <Navigation />
      </aside>

      {/* Main Content Area */}
      <main className="flex flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
