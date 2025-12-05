'use client';

import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Sparkles, Brain, FileText, Search } from 'lucide-react';
import { MathText } from '@/components/ui/MathText';

export default function LandingPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-background relative overflow-hidden">
            {/* Background Elements */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]"
                style={{
                    backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
                    backgroundSize: '40px 40px'
                }}
            />

            {/* Floating Math Symbols (Decorative) */}
            <div className="absolute top-20 left-10 text-6xl text-primary/5 animate-pulse select-none z-0">
                <MathText>{'\\sum_{i=1}^n i^2'}</MathText>
            </div>
            <div className="absolute bottom-40 right-20 text-6xl text-primary/5 animate-pulse delay-700 select-none z-0">
                <MathText>{'\\int_0^\\infty e^{-x^2} dx'}</MathText>
            </div>
            <div className="absolute top-1/3 right-1/4 text-4xl text-primary/5 animate-pulse delay-1000 select-none z-0">
                <MathText>{'E = mc^2'}</MathText>
            </div>

            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
                <div className="container mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                            <Brain className="w-5 h-5 text-primary" />
                        </div>
                        <span className="text-lg font-bold tracking-tight">智题云卷</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="sm" onClick={() => router.push('/login')}>
                            登录
                        </Button>
                        <Button size="sm" onClick={() => router.push('/register')}>
                            免费注册
                        </Button>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 z-10">
                <div className="container mx-auto px-6 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <Sparkles className="h-3 w-3" />
                        <span>AI 驱动的智能组卷平台</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                        Math + AI = <span className="text-gradient">Your New Workflow</span>
                    </h1>

                    <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                        从一张照片，到一份完美的 LaTeX 试卷。
                        <br />
                        自动识别、智能去噪、语义搜题，让教研回归思考。
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
                        <Button size="lg" onClick={() => router.push('/register')} className="h-12 px-8 text-base shadow-lg shadow-primary/20">
                            立即开始使用 <ArrowRight className="ml-2 w-4 h-4" />
                        </Button>
                        <Button size="lg" variant="outline" onClick={() => router.push('/login')} className="h-12 px-8 text-base">
                            演示账号登录
                        </Button>
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section className="py-24 bg-secondary/30 border-y border-border/50">
                <div className="container mx-auto px-6">
                    <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                        <div className="p-6 rounded-2xl bg-background border border-border/50 hover:border-primary/20 transition-colors group">
                            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">智能 OCR 识别</h3>
                            <p className="text-muted-foreground">
                                上传手写或印刷体题目，AI 自动转换为标准 LaTeX 格式，完美还原数学公式与几何图形。
                            </p>
                        </div>

                        <div className="p-6 rounded-2xl bg-background border border-border/50 hover:border-primary/20 transition-colors group">
                            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Search className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">语义题库搜索</h3>
                            <p className="text-muted-foreground">
                                告别关键词匹配。通过语义理解，精准找到你想要的相似题目，快速构建专属题库。
                            </p>
                        </div>

                        <div className="p-6 rounded-2xl bg-background border border-border/50 hover:border-primary/20 transition-colors group">
                            <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Brain className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">AI 辅助组卷</h3>
                            <p className="text-muted-foreground">
                                智能分析试卷难度与知识点分布，一键生成专业 PDF 试卷，支持自定义排版。
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Tech Stack / Trust */}
            <section className="py-20">
                <div className="container mx-auto px-6 text-center">
                    <p className="text-sm text-muted-foreground mb-8 uppercase tracking-wider">Powered By Modern AI Stack</p>
                    <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
                        <div className="flex items-center gap-2 font-semibold text-lg">
                            <span className="text-sky-500">⚛</span> React & Next.js
                        </div>
                        <div className="flex items-center gap-2 font-semibold text-lg">
                            <span className="text-emerald-500">▲</span> Vercel
                        </div>
                        <div className="flex items-center gap-2 font-semibold text-lg">
                            <span className="text-blue-500">G</span> Gemini Pro
                        </div>
                        <div className="flex items-center gap-2 font-semibold text-lg">
                            <span className="text-green-600">K</span> KaTeX
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-border/40 py-8">
                <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
                    <p>© 2025 智题云卷. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}
