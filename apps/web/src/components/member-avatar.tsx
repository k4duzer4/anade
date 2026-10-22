'use client';
import Image from 'next/image';
import { useState } from 'react';
import { initials } from '@/lib/types';

export function MemberAvatar({
  src,
  name,
  className = 'avatar',
}: {
  src?: string;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState('');
  return (
    <span className={className}>
      {src && failed !== src ? (
        <Image
          src={src}
          alt={`Foto de ${name}`}
          width={128}
          height={128}
          unoptimized
          onError={() => setFailed(src)}
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}
