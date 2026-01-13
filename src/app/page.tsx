import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Activity, Settings } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-emerald-950">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">
            Setup Complete ✓
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-4">
            WhatsApp Interface
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            Headless WhatsApp Business API interface powered by Next.js, Supabase, and Shadcn/UI.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <Link href="/inbox">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <MessageSquare className="w-8 h-8 text-emerald-600 mb-2" />
                <CardTitle>Inbox</CardTitle>
                <CardDescription>
                  Manage conversations and messages
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  Open Inbox
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Link href="/activity">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <Activity className="w-8 h-8 text-blue-600 mb-2" />
                <CardTitle>Activity</CardTitle>
                <CardDescription>
                  View message logs and history
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  View Activity
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Link href="/settings">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <Settings className="w-8 h-8 text-zinc-600 mb-2" />
                <CardTitle>Settings</CardTitle>
                <CardDescription>
                  Configure API and preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  Open Settings
                </Button>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="mt-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
          <p>TailwindCSS: <span className="text-emerald-600 font-medium">Working</span> • Shadcn/UI: <span className="text-emerald-600 font-medium">Working</span> • Lucide Icons: <span className="text-emerald-600 font-medium">Working</span></p>
        </div>
      </div>
    </div>
  );
}
