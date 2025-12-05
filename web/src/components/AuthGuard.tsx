'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authApi } from '@/lib/api-client';

// 不需要登录的页面
const publicPaths = ['/login', '/register', '/'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [isChecking, setIsChecking] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        // 公开页面不需要检查
        if (publicPaths.includes(pathname)) {
            setIsChecking(false);
            setIsAuthenticated(true);
            return;
        }

        // 检查是否已登录
        const token = authApi.getToken();
        if (!token) {
            router.replace('/login');
            return;
        }

        setIsAuthenticated(true);
        setIsChecking(false);
    }, [pathname, router]);

    // 正在检查中，显示加载状态
    if (isChecking) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-gray-500">加载中...</div>
            </div>
        );
    }

    // 未认证且不是公开页面，不渲染任何内容（会被重定向）
    if (!isAuthenticated && !publicPaths.includes(pathname)) {
        return null;
    }

    return <>{children}</>;
}
