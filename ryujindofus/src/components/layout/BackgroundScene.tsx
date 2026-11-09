import React, { useEffect, useState } from 'react';

export const BackgroundScene: React.FC = () => {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Verificar se movimento reduzido está ativo ou se não tem ponteiro fino
    const mediaMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mediaPointer = window.matchMedia('(pointer: fine)');

    if (mediaMotion.matches || !mediaPointer.matches) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      // Normalizar de -1 a 1 a partir do centro da tela
      const nx = (e.clientX / innerWidth - 0.5) * 2;
      const ny = (e.clientY / innerHeight - 0.5) * 2;
      setOffset({ x: nx, y: ny });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Deslocamento dos orbes: oposto ao cursor, até ±18px
  const orbTransform = `translate3d(${-offset.x * 18}px, ${-offset.y * 18}px, 0)`;
  // Deslocamento do símbolo do dragão: oposto ao cursor, até ±8px
  const dragonTransform = `translate3d(${-offset.x * 8}px, ${-offset.y * 8}px, 0)`;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
      style={{
        background: 'linear-gradient(180deg, #0B1D33 0%, #050B14 50%, #02050A 100%)',
      }}
    >
      {/* Camada 2: Orbes de luz difusa */}
      <div
        className="absolute inset-0 transition-transform duration-600 ease-out"
        style={{ transform: orbTransform }}
      >
        {/* Orbe 1 */}
        <div
          className="absolute rounded-full"
          style={{
            width: '680px',
            height: '680px',
            left: '-180px',
            top: '-200px',
            backgroundColor: '#24598A',
            opacity: 0.65,
            filter: 'blur(110px)',
          }}
        />

        {/* Orbe 2 */}
        <div
          className="absolute rounded-full"
          style={{
            width: '560px',
            height: '560px',
            right: '-120px',
            top: '25%',
            backgroundColor: '#17385A',
            opacity: 0.8,
            filter: 'blur(110px)',
          }}
        />

        {/* Orbe 3 */}
        <div
          className="absolute rounded-full"
          style={{
            width: '420px',
            height: '420px',
            left: '12%',
            bottom: '-180px',
            backgroundColor: '#0F7A87',
            opacity: 0.4,
            filter: 'blur(110px)',
          }}
        />
      </div>

      {/* Camada 3: Raios de luz vindos do alto */}
      <div
        className="absolute pointer-events-none"
        style={{
          inset: '-5% -10% 20% 35%',
          background:
            'repeating-linear-gradient(108deg, transparent 0px, transparent 70px, rgba(150, 215, 240, 0.045) 110px, transparent 170px)',
          maskImage: 'linear-gradient(180deg, #000 0%, transparent 75%)',
          WebkitMaskImage: 'linear-gradient(180deg, #000 0%, transparent 75%)',
        }}
      />

      {/* Camada 4: Símbolo do dragão gigante a 7% de opacidade */}
      <div
        className="absolute right-[-140px] top-[10%] h-[900px] aspect-[257/440] transition-transform duration-600 ease-out"
        style={{
          transform: dragonTransform,
          color: '#BFE3F2',
          opacity: 0.07,
        }}
      >
        <div className="w-full h-full mark" />
      </div>

      {/* Camada 5: Neve marinha (5 partículas em radial-gradient repetido com 520px) */}
      <div
        className="absolute inset-0 animate-marine-snow opacity-60"
        style={{
          height: '200%',
          backgroundImage: `
            radial-gradient(1.5px 1.5px at 120px 80px, rgba(210, 235, 250, 0.55), transparent),
            radial-gradient(1px 1px at 340px 190px, rgba(210, 235, 250, 0.35), transparent),
            radial-gradient(2px 2px at 460px 310px, rgba(210, 235, 250, 0.45), transparent),
            radial-gradient(1px 1px at 80px 420px, rgba(210, 235, 250, 0.4), transparent),
            radial-gradient(1.5px 1.5px at 280px 490px, rgba(210, 235, 250, 0.5), transparent)
          `,
          backgroundSize: '520px 520px',
        }}
      />

      {/* Camada 6: Ruído (grain) SVG feTurbulence embutido a 3% de opacidade */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.03] pointer-events-none mix-blend-overlay"
        xmlns="http://www.w3.org/2000/svg"
      >
        <filter id="noiseFilter">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noiseFilter)" />
      </svg>
    </div>
  );
};

