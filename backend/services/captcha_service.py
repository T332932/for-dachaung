"""
验证码服务 - 生成图片验证码
"""
import random
import string
import time
import base64
from io import BytesIO
from typing import Dict, Tuple

# 验证码存储 (生产环境应使用 Redis)
_captcha_store: Dict[str, Tuple[str, float]] = {}
CAPTCHA_EXPIRE_SECONDS = 300  # 5分钟过期


def generate_captcha_id() -> str:
    """生成唯一的验证码 ID"""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=16))


def generate_captcha_text(length: int = 4) -> str:
    """生成验证码文本（排除容易混淆的字符）"""
    chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  # 排除 I O 0 1
    return ''.join(random.choices(chars, k=length))


def create_captcha_image(text: str) -> str:
    """
    生成验证码图片，返回 base64 编码的 PNG
    使用简单的 ASCII 艺术风格验证码（无需图像库）
    """
    try:
        # 尝试使用 PIL 生成高质量验证码
        from PIL import Image, ImageDraw, ImageFont
        import io
        
        width, height = 120, 40
        image = Image.new('RGB', (width, height), color=(255, 255, 255))
        draw = ImageDraw.Draw(image)
        
        # 添加干扰线
        for _ in range(3):
            x1 = random.randint(0, width)
            y1 = random.randint(0, height)
            x2 = random.randint(0, width)
            y2 = random.randint(0, height)
            draw.line([(x1, y1), (x2, y2)], fill=(200, 200, 200), width=1)
        
        # 绘制文字
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 28)
        except:
            font = ImageFont.load_default()
        
        # 每个字符随机位置和颜色
        x = 10
        for char in text:
            color = (random.randint(0, 100), random.randint(0, 100), random.randint(0, 100))
            y = random.randint(2, 8)
            draw.text((x, y), char, font=font, fill=color)
            x += 25
        
        # 添加噪点
        for _ in range(50):
            x = random.randint(0, width)
            y = random.randint(0, height)
            draw.point((x, y), fill=(150, 150, 150))
        
        # 转为 base64
        buffer = io.BytesIO()
        image.save(buffer, format='PNG')
        img_base64 = base64.b64encode(buffer.getvalue()).decode()
        return f"data:image/png;base64,{img_base64}"
    
    except ImportError:
        # PIL 不可用，使用 SVG 替代
        return create_captcha_svg(text)


def create_captcha_svg(text: str) -> str:
    """使用 SVG 生成验证码（无需额外依赖）"""
    width, height = 120, 40
    
    # SVG 头部
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}">
    <rect width="100%" height="100%" fill="white"/>'''
    
    # 添加干扰线
    for _ in range(3):
        x1, y1 = random.randint(0, width), random.randint(0, height)
        x2, y2 = random.randint(0, width), random.randint(0, height)
        svg += f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#ddd" stroke-width="1"/>'
    
    # 绘制文字
    x = 10
    for char in text:
        r, g, b = random.randint(0, 100), random.randint(0, 100), random.randint(0, 100)
        y = random.randint(25, 32)
        rotate = random.randint(-15, 15)
        svg += f'<text x="{x}" y="{y}" font-size="24" font-weight="bold" fill="rgb({r},{g},{b})" transform="rotate({rotate} {x} {y})">{char}</text>'
        x += 25
    
    svg += '</svg>'
    
    # 转为 base64
    svg_base64 = base64.b64encode(svg.encode()).decode()
    return f"data:image/svg+xml;base64,{svg_base64}"


def create_captcha() -> Tuple[str, str]:
    """
    创建新验证码
    返回: (captcha_id, image_base64)
    """
    captcha_id = generate_captcha_id()
    captcha_text = generate_captcha_text()
    captcha_image = create_captcha_image(captcha_text)
    
    # 存储验证码（小写存储，验证时也用小写比较）
    _captcha_store[captcha_id] = (captcha_text.upper(), time.time())
    
    # 清理过期验证码
    _cleanup_expired()
    
    return captcha_id, captcha_image


def verify_captcha(captcha_id: str, captcha_code: str) -> bool:
    """
    验证验证码
    """
    if not captcha_id or not captcha_code:
        return False
    
    stored = _captcha_store.get(captcha_id)
    if not stored:
        return False
    
    text, created_at = stored
    
    # 检查是否过期
    if time.time() - created_at > CAPTCHA_EXPIRE_SECONDS:
        del _captcha_store[captcha_id]
        return False
    
    # 验证成功后删除（一次性使用）
    if captcha_code.upper() == text:
        del _captcha_store[captcha_id]
        return True
    
    return False


def _cleanup_expired():
    """清理过期的验证码"""
    now = time.time()
    expired = [k for k, (_, t) in _captcha_store.items() if now - t > CAPTCHA_EXPIRE_SECONDS]
    for k in expired:
        del _captcha_store[k]
