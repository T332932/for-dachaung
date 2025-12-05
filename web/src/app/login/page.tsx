'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Lock, ArrowRight } from 'lucide-react';
import { authApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuthLayout } from '@/components/layout/AuthLayout';

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!username.trim() || !password.trim()) {
            setError('请输入用户名和密码');
            return;
        }

        setLoading(true);
        try {
            await authApi.login(username, password);
            router.push('/');
        } catch (err: any) {
            setError(err?.userMessage || '登录失败，请检查用户名和密码');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout
            title="欢迎回来"
            subtitle="请输入您的账号密码登录系统"
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                    <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-xl text-sm font-medium flex items-center animate-in slide-in-from-top-2">
                        <span className="mr-2">⚠️</span> {error}
                    </div>
                )}

                <div className="space-y-4">
                    <Input
                        label="用户名"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="请输入用户名"
                        leftIcon={<User className="w-4 h-4" />}
                        disabled={loading}
                    />

                    <div className="space-y-1">
                        <Input
                            label="密码"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="请输入密码"
                            leftIcon={<Lock className="w-4 h-4" />}
                            disabled={loading}
                        />
                        <div className="flex justify-end">
                            <Link href="#" className="text-xs text-primary hover:underline">
                                忘记密码？
                            </Link>
                        </div>
                    </div>
                </div>

                <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    isLoading={loading}
                >
                    登录系统 <ArrowRight className="ml-2 w-4 h-4" />
                </Button>

                <div className="text-center text-sm text-muted-foreground">
                    还没有账号？
                    <Link href="/register" className="text-primary font-medium hover:underline ml-1">
                        立即注册
                    </Link>
                </div>
            </form>
        </AuthLayout>
    );
}
