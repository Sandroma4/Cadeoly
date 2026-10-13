"use client";
import Image from "next/image";
import { useState } from "react";
import styles from "./UserAvatar.module.css";

export function UserAvatar({
  name,
  src,
  size = 40,
  className = "",
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span
      className={`${styles.avatar} ${className}`}
      style={{ width: size, height: size }}
    >
      {src && src !== failed ? (
        <Image
          src={src}
          alt={name}
          width={size}
          height={size}
          unoptimized
          onError={() => setFailed(src)}
        />
      ) : (
        <span aria-hidden="true">{name.trim()[0]?.toUpperCase() || "U"}</span>
      )}
    </span>
  );
}
