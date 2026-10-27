"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { wallKvAssetSrc } from "@/lib/wall-kv-layout";

const STAR_SRC = "/assets/wall-kv/star-twinkle.png";
const STAR_COUNT = 10;

type StarSpec = {
  id: number;
  leftPct: number;
  topPct: number;
  sizePct: number;
  rotateDeg: number;
  durationS: number;
  delayS: number;
  minOpacity: number;
};

function randomStar(id: number): StarSpec {
  return {
    id,
    leftPct: 3 + Math.random() * 94,
    topPct: 2 + Math.random() * 82,
    sizePct: (14 + Math.random() * 22) / 1024,
    rotateDeg: Math.random() * 360,
    durationS: 1.6 + Math.random() * 2.8,
    delayS: Math.random() * 4.5,
    minOpacity: 0.2 + Math.random() * 0.45,
  };
}

function createRandomStars(): StarSpec[] {
  return Array.from({ length: STAR_COUNT }, (_, i) => randomStar(i));
}

/** Decorative twinkle stars — new random layout each wall load. */
export function WallKvTwinkleStars() {
  const src = wallKvAssetSrc(STAR_SRC);
  const [stars, setStars] = useState<StarSpec[] | null>(null);

  useEffect(() => {
    setStars(createRandomStars());
  }, []);

  if (!stars) return null;

  return (
    <div className="wall-kv-twinkle-stars" aria-hidden>
      {stars.map((star) => (
        <img
          key={star.id}
          src={src}
          alt=""
          className="wall-kv-twinkle-star"
          draggable={false}
          style={
            {
              left: `${star.leftPct}%`,
              top: `${star.topPct}%`,
              width: `${star.sizePct * 100}%`,
              ["--star-rotate" as string]: `${star.rotateDeg}deg`,
              ["--star-dur" as string]: `${star.durationS}s`,
              ["--star-delay" as string]: `${star.delayS}s`,
              ["--star-min" as string]: String(star.minOpacity),
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
