'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Lock, Mail, Key, RefreshCw, ArrowRight } from 'lucide-react';
import { authApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuthLayout } from '@/components/layout/AuthLayout';

export default function RegisterPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [email, setEmail] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [captchaId, setCaptchaId] = useState('');
    const [captchaImage, setCaptchaImage] = useState('');
    const [captchaCode, setCaptchaCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // 加载验证码
    const loadCaptcha = useCallback(async () => {
        try {
            const data = await authApi.getCaptcha();
            setCaptchaId(data.captchaId);
            setCaptchaImage(data.captchaImage);
            setCaptchaCode('');
        } catch (err) {
            console.error('Failed to load captcha:', err);
        }
    }, []);

    useEffect(() => {
        loadCaptcha();
    }, [loadCaptcha]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!username.trim() || !password.trim()) {
            setError('请输入用户名和密码');
            return;
        }

        if (password !== confirmPassword) {
            setError('两次输入的密码不一致');
            return;
        }

        if (password.length < 6) {
            setError('密码长度至少为6位');
            return;
        }

        if (!captchaCode.trim()) {
            setError('请输入验证码');
            return;
        }

        setLoading(true);
        try {
            await authApi.register({
                username,
                password,
                email: email || undefined,
                role: 'teacher',
                inviteCode: inviteCode || undefined,
                captchaId,
                captchaCode,
            });
            alert('注册成功！请登录');
            router.push('/login');
        } catch (err: any) {
            setError(err?.userMessage || err?.response?.data?.detail || err?.message || '注册失败');
            loadCaptcha();
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout
            title="创建账号"
            subtitle="加入智能组卷系统，开启高效教学"
        >
            <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                    <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-xl text-sm font-medium flex items-center animate-in slide-in-from-top-2">
                        <span className="mr-2">⚠️</span> {error}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                    <Input
                        label="用户名"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="请输入用户名"
                        leftIcon={<User className="w-4 h-4" />}
                        disabled={loading}
                    />

                    <Input
                        label="邮箱 (可选)"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="请输入邮箱"
                        leftIcon={<Mail className="w-4 h-4" />}
                        disabled={loading}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="密码"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="至少6位"
                            leftIcon={<Lock className="w-4 h-4" />}
                            disabled={loading}
                        />
                        <Input
                            label="确认密码"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="重复密码"
                            leftIcon={<Lock className="w-4 h-4" />}
                            disabled={loading}
                        />
                    </div>

                    <Input
                        label="邀请码 (可选)"
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value)}
                        placeholder="如有请填写"
                        leftIcon={<Key className="w-4 h-4" />}
                        disabled={loading}
                    />

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">验证码</label>
                        <div className="flex gap-3">
                            <div className="relative flex-1">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                    <Key className="w-4 h-4" />
                                </div>
                                <input
                                    type="text"
                                    value={captchaCode}
                                    onChange={(e) => setCaptchaCode(e.target.value.toUpperCase())}
                                    className="flex h-11 w-full rounded-xl border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                                    placeholder="输入验证码"
                                    disabled={loading}
                                    maxLength={4}
                                />
                            </div>
                            <div
                                className="relative group cursor-pointer"
                                onClick={loadCaptcha}
                                title="点击刷新"
                            >
                                {captchaImage ? (
                                    <img
                                        src={captchaImage}
                                        alt="验证码"
                                        className="h-11 w-32 object-cover rounded-xl border border-input hover:opacity-80 transition-opacity"
                                    />
                                ) : (
                                    <div className="h-11 w-32 bg-secondary rounded-xl flex items-center justify-center text-xs text-muted-foreground animate-pulse">
                                        加载中...
                                    </div>
                                )}
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 rounded-xl">
                                    <RefreshCw className="w-4 h-4 text-white drop-shadow-md" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <Button
                    type="submit"
                    className="w-full mt-2"
                    size="lg"
                    isLoading={loading}
                >
                    立即注册 <ArrowRight className="ml-2 w-4 h-4" />
                </Button>

                <div className="text-center text-sm text-muted-foreground">
                    已有账号？
                    <Link href="/login" className="text-primary font-medium hover:underline ml-1">
                        立即登录
                    </Link>
                </div>
            </form>
        </AuthLayout>
    );
}
