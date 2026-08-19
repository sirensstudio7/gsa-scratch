"use client";

import { WallRevealAsset } from "@/components/WallRevealAsset";
import { SCRATCH_OBJECTS, type ScratchId } from "@/lib/types";

type AssetProgress = Record<ScratchId, number>;

const FLOAT_OBJECTS: { id: ScratchId; className: string }[] = [
  {
    id: "ribbon",
    className: "wall-float-piece wall-float-piece--ribbon",
  },
  {
    id: "hat",
    className: "wall-float-piece wall-float-piece--hat",
  },
  {
    id: "pencil",
    className: "wall-float-piece wall-float-piece--pencil",
  },
];

const EXTRAS = [
  {
    src: "/assets/wall-float-books.png",
    className: "wall-float-piece wall-float-piece--books",
  },
  {
    src: "/assets/wall-float-stars-gold.png",
    className: "wall-float-piece wall-float-piece--stars-gold",
  },
  {
    src: "/assets/wall-float-stars-green.png",
    className: "wall-float-piece wall-float-piece--stars-green",
  },
  {
    src: "/assets/wall-float-bit-a.png",
    className: "wall-float-piece wall-float-piece--bit-a",
  },
  {
    src: "/assets/wall-float-bit-c.png",
    className: "wall-float-piece wall-float-piece--bit-c",
  },
  {
    src: "/assets/wall-float-bit-d.png",
    className: "wall-float-piece wall-float-piece--bit-d",
  },
  {
    src: "/assets/wall-float-bit-e.png",
    className: "wall-float-piece wall-float-piece--bit-e",
  },
  {
    src: "/assets/wall-float-bit-f.png",
    className: "wall-float-piece wall-float-piece--bit-f",
  },
  {
    src: "/assets/wall-float-bit-g.png",
    className: "wall-float-piece wall-float-piece--bit-g",
  },
  {
    src: "/assets/wall-float-bit-h.png",
    className: "wall-float-piece wall-float-piece--bit-h",
  },
] as const;

type WallFloatDecorProps = {
  progress: AssetProgress;
};

/** HQ hat/ribbon/pencil scratch as students submit toward the staff target. */
export function WallFloatDecor({ progress }: WallFloatDecorProps) {
  return (
    <div className="wall-float-decor" aria-hidden>
      {FLOAT_OBJECTS.map((piece) => {
        const obj = SCRATCH_OBJECTS.find((o) => o.id === piece.id);
        if (!obj) return null;
        return (
          <div key={piece.id} className={piece.className}>
            <WallRevealAsset
              colorSrc={obj.colorSrc}
              whiteSrc={obj.maskSrc}
              alt={obj.label}
              progress={progress[piece.id]}
              boxed={false}
              className="wall-float-reveal"
            />
          </div>
        );
      })}
      {EXTRAS.map((piece) => (
        <img
          key={piece.className}
          src={`${piece.src}?v=2`}
          alt=""
          draggable={false}
          className={piece.className}
        />
      ))}
    </div>
  );
}
