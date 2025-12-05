import React from 'react';
import Link from 'next/link';

interface AuthLayoutProps {
    children: React.ReactNode;
    title: string;
    subtitle: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
    return (
        <div className="min-h-screen w-full flex bg-background">
            {/* Left Side - Branding & Art */}
            <div className="hidden lg:flex w-1/2 relative bg-slate-900 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 to-violet-600/20 z-10" />
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
                <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-violet-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
                <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-amber-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />

                <div className="relative z-20 flex flex-col justify-between p-12 w-full text-white">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center font-bold text-lg">
                            Z
                        </div>
                        <span className="text-xl font-bold tracking-tight">智能组卷系统</span>
                    </div>

                    <div className="space-y-6 max-w-lg">
                        <h1 className="text-4xl font-bold leading-tight">
                            AI 驱动的<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
                                智能教育解决方案
                            </span>
                        </h1>
                        <p className="text-slate-400 text-lg">
                            一键识别题目，智能语义搜索，快速组卷。让教育更高效，让出题更简单。
                        </p>
                    </div>

                    <div className="text-sm text-slate-500">
                        © 2025 Zujuan AI. All rights reserved.
                    </div>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center lg:text-left">
                        <h2 className="text-3xl font-bold tracking-tight text-foreground">{title}</h2>
                        <p className="mt-2 text-muted-foreground">{subtitle}</p>
                    </div>

                    {children}
                </div>
            </div>
        </div>
    );
}
