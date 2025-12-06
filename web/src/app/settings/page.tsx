'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { User, Lock, LogOut, Save } from 'lucide-react';

export default function SettingsPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        // 从 localStorage 获取用户名
        if (typeof window !== 'undefined') {
            const storedUser = localStorage.getItem('zujuan_user');
            if (storedUser) {
                try {
                    const user = JSON.parse(storedUser);
                    setUsername(user.username || '');
                } catch {
                    // ignore
                }
            }
        }
    }, []);

    const handleLogout = () => {
        if (confirm('确定要退出登录吗？')) {
            localStorage.removeItem('zujuan_token');
            localStorage.removeItem('zujuan_user');
            router.push('/login');
        }
    };

    const handleChangePassword = async () => {
        if (!currentPassword) {
            alert('请输入当前密码');
            return;
        }
        if (!newPassword) {
            alert('请输入新密码');
            return;
        }
        if (newPassword.length < 6) {
            alert('新密码至少 6 位');
            return;
        }
        if (newPassword !== confirmPassword) {
            alert('两次输入的密码不一致');
            return;
        }

        setSaving(true);
        try {
            // TODO: 调用后端修改密码 API
            alert('密码修改功能开发中');
        } catch (error: any) {
            alert(error?.userMessage || '修改失败');
        } finally {
            setSaving(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="space-y-6 max-w-2xl">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">个人设置</h1>
                    <p className="text-muted-foreground">管理您的账户信息</p>
                </div>

                {/* 账户信息 */}
                <Card className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <User className="w-5 h-5 text-muted-foreground" />
                        <h2 className="text-lg font-semibold">账户信息</h2>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-2">用户名</label>
                            <Input
                                value={username}
                                disabled
                                className="max-w-sm"
                            />
                            <p className="text-xs text-muted-foreground mt-1">用户名不可修改</p>
                        </div>
                    </div>
                </Card>

                {/* 修改密码 */}
                <Card className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <Lock className="w-5 h-5 text-muted-foreground" />
                        <h2 className="text-lg font-semibold">修改密码</h2>
                    </div>

                    <div className="space-y-4 max-w-sm">
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-2">当前密码</label>
                            <Input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="请输入当前密码"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-2">新密码</label>
                            <Input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="请输入新密码（至少 6 位）"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-2">确认新密码</label>
                            <Input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="请再次输入新密码"
                            />
                        </div>
                        <Button onClick={handleChangePassword} disabled={saving} className="gap-2">
                            <Save className="w-4 h-4" />
                            {saving ? '保存中...' : '修改密码'}
                        </Button>
                    </div>
                </Card>

                {/* 退出登录 */}
                <Card className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <LogOut className="w-5 h-5 text-muted-foreground" />
                        <h2 className="text-lg font-semibold">退出登录</h2>
                    </div>

                    <p className="text-sm text-muted-foreground mb-4">
                        退出当前账户，需要重新登录才能访问系统。
                    </p>

                    <Button variant="danger" onClick={handleLogout} className="gap-2">
                        <LogOut className="w-4 h-4" />
                        退出登录
                    </Button>
                </Card>
            </div>
        </DashboardLayout>
    );
}
