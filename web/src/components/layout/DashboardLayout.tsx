'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    BookOpen,
    FileText,
    LogOut,
    Menu,
    X,
    User,
    PlusCircle,
    Upload
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/api-client';
import { cn } from '@/components/ui/button'; // Re-using cn utility

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [user, setUser] = useState<{ username: string } | null>(null);

    useEffect(() => {
        // Simple user check (in real app, fetch profile)
        const token = authApi.getToken();
        if (token) {
            // Decode token or fetch user info if available
            // For now just mock or use what we have
            setUser({ username: 'Teacher' });
        }
    }, []);

    const handleLogout = () => {
        authApi.logout();
        router.push('/login');
    };

    const navItems = [
        { href: '/dashboard', label: '题目上传', icon: <LayoutDashboard className="w-5 h-5" /> },
        { href: '/batch', label: '批量上传', icon: <Upload className="w-5 h-5" /> },
        { href: '/questions', label: '题库浏览', icon: <BookOpen className="w-5 h-5" /> },
        { href: '/papers', label: '我的试卷', icon: <FileText className="w-5 h-5" /> },
    ];

    return (
        <div className="min-h-screen bg-background flex">
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card fixed h-full z-30">
                <div className="p-6 border-b border-border flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center font-bold text-white text-lg">
                        Z
                    </div>
                    <span className="text-xl font-bold tracking-tight text-foreground">智能组卷</span>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                                    isActive
                                        ? "bg-primary/10 text-primary shadow-sm"
                                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                                )}
                            >
                                {item.icon}
                                {item.label}
                            </Link>
                        );
                    })}

                    <div className="pt-4 mt-4 border-t border-border">
                        <Link
                            href="/papers/create"
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                                pathname === '/papers/create'
                                    ? "bg-primary/10 text-primary shadow-sm"
                                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                            )}
                        >
                            <PlusCircle className="w-5 h-5" />
                            创建新试卷
                        </Link>
                    </div>
                </nav>

                <div className="p-4 border-t border-border">
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary/50 mb-2">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                            <User className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                                {user?.username || '用户'}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                                教师账号
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={handleLogout}
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        退出登录
                    </Button>
                </div>
            </aside>

            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b border-border z-40 flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center font-bold text-white text-lg">
                        Z
                    </div>
                    <span className="text-lg font-bold text-foreground">智能组卷</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                    {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </Button>
            </div>

            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div className="md:hidden fixed inset-0 z-30 bg-background pt-16 px-4 pb-6 flex flex-col animate-in slide-in-from-top-10">
                    <nav className="flex-1 space-y-2 mt-4">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                                    pathname === item.href
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:bg-secondary"
                                )}
                            >
                                {item.icon}
                                {item.label}
                            </Link>
                        ))}
                        <Link
                            href="/papers/create"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                                pathname === '/papers/create'
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-secondary"
                            )}
                        >
                            <PlusCircle className="w-5 h-5" />
                            创建新试卷
                        </Link>
                    </nav>
                    <div className="pt-4 border-t border-border">
                        <Button
                            variant="danger"
                            className="w-full justify-center"
                            onClick={handleLogout}
                        >
                            <LogOut className="w-4 h-4 mr-2" />
                            退出登录
                        </Button>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <main className="flex-1 md:pl-64 pt-16 md:pt-0 min-h-screen transition-all duration-200 ease-in-out">
                <div className="max-w-7xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
                    {children}
                </div>
            </main>
        </div>
    );
}
