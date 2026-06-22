import Image from "next/image";

interface AvatarProps {
  src: string | null;
  name?: string | null;
  username?: string | null;
  size: number;
  className?: string;
}

// djb2 — стабильный hash без коллизий на коротких ASCII-никах. Тот же seed
// возвращает тот же hue на любой странице, в любой сессии, в любом рендере.
function hueFromString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 360;
}

function pickLetter(name?: string | null, username?: string | null): string {
  const src = (name ?? username ?? "").trim();
  if (!src) return "?";
  return src.charAt(0).toUpperCase();
}

// Единая аватарка для всех мест UI: header, comments, post-card, profile.
// Есть src → next/image; нет → круг с первой буквой, фон hsl от хеша username
// (или name, если username пуст). Текст белый, насыщенность/светлота
// фиксированы так, чтобы контраст работал в обеих темах.
export function Avatar({ src, name, username, size, className = "" }: AvatarProps) {
  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={size}
        height={size}
        className={`rounded-full shrink-0 ${className}`}
      />
    );
  }
  const seed = (username ?? name ?? "?").toLowerCase();
  const hue = hueFromString(seed);
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        backgroundColor: `hsl(${hue}, 60%, 45%)`,
        fontSize: Math.round(size * 0.45),
      }}
      className={`rounded-full shrink-0 inline-flex items-center justify-center text-white font-medium leading-none select-none ${className}`}
    >
      {pickLetter(name, username)}
    </div>
  );
}
