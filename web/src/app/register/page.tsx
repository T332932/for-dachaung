'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api-client';

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
            // 注册失败时刷新验证码
            loadCaptcha();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-teal-100">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-gray-800">📝 教师注册</h1>
                        <p className="text-gray-500 mt-2">创建您的账号</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                用户名 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                                placeholder="请输入用户名"
                                disabled={loading}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                邮箱 <span className="text-gray-400">(可选)</span>
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                                placeholder="请输入邮箱"
                                disabled={loading}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                密码 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                                placeholder="请输入密码（至少6位）"
                                disabled={loading}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                确认密码 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                                placeholder="请再次输入密码"
                                disabled={loading}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                邀请码 <span className="text-gray-400">(如有请填写)</span>
                            </label>
                            <input
                                type="text"
                                value={inviteCode}
                                onChange={(e) => setInviteCode(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                                placeholder="请输入邀请码"
                                disabled={loading}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                验证码 <span className="text-red-500">*</span>
                            </label>
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    value={captchaCode}
                                    onChange={(e) => setCaptchaCode(e.target.value.toUpperCase())}
                                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                                    placeholder="请输入验证码"
                                    disabled={loading}
                                    maxLength={4}
                                />
                                {captchaImage ? (
                                    <img
                                        src={captchaImage}
                                        alt="验证码"
                                        className="h-12 rounded-lg cursor-pointer border hover:opacity-80"
                                        onClick={loadCaptcha}
                                        title="点击刷新"
                                    />
                                ) : (
                                    <div className="w-24 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-sm text-gray-400">
                                        加载中...
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-gray-400 mt-1">点击图片刷新验证码</p>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? '注册中...' : '注册'}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-sm text-gray-500">
                        已有账号？
                        <Link href="/login" className="text-green-600 hover:underline ml-1">
                            立即登录
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
