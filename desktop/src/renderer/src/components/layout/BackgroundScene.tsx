import React, { useEffect, useRef, useState } from 'react';
import ryujinDark from '../../assets/brand/ryujin-dark.png';
import ryujinLight from '../../assets/brand/ryujin-light.png';

interface BackgroundSceneProps {
  theme?: 'dark' | 'light';
}

export const BackgroundScene: React.FC<BackgroundSceneProps> = ({ theme = 'dark' }) => {
  const [isPaused, setIsPaused] = useState(false);
  const mouseTarget = useRef({ x: 0, y: 0 });
  const mouseCurrent = useRef({ x: 0, y: 0 });
  const [orbOffset, setOrbOffset] = useState({ x: 0, y: 0 });
  const [dragonOffset, setDragonOffset] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    // Detect reduced motion
    const mediaMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaMotion.matches) return;

    // Pause when window is not focused or hidden
    const handleVisibility = () => {
      setIsPaused(document.hidden);
    };
    const handleFocus = () => setIsPaused(false);
    const handleBlur = () => setIsPaused(true);

    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    // Mouse parallax target
    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      mouseTarget.current = {
        x: (e.clientX / innerWidth - 0.5) * 2,
        y: (e.clientY / innerHeight - 0.5) * 2
      };
    };

    // Scroll parallax (0.3x)
    const handleScroll = () => {
      setScrollY(window.scrollY * 0.3);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });

    // RAF Loop for smooth lerp
    let rafId: number;
    const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor;

    const animate = () => {
      mouseCurrent.current.x = lerp(mouseCurrent.current.x, mouseTarget.current.x, 0.05);
      mouseCurrent.current.y = lerp(mouseCurrent.current.y, mouseTarget.current.y, 0.05);

      setOrbOffset({
        x: -mouseCurrent.current.x * 18,
        y: -mouseCurrent.current.y * 18
      });

      setDragonOffset({
        x: -mouseCurrent.current.x * 8,
        y: -mouseCurrent.current.y * 8
      });

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const isDark = theme === 'dark';
  const logoSrc = isDark ? ryujinDark : ryujinLight;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-0 overflow-hidden select-none ${isPaused ? 'paused' : ''}`}
      style={{
        background: isDark
          ? 'linear-gradient(180deg, #0B1D33 0%, #050B14 50%, #02050A 100%)'
          : 'linear-gradient(180deg, #F4F8FC 0%, #DDE8F4 50%, #D3E1F0 100%)',
        transition: 'background 200ms ease'
      }}
    >
      {/* Camada 2: 3 Orbes Luminosos com Parallax */}
      <div
        className="absolute inset-0 transition-transform duration-300 ease-out"
        style={{
          transform: `translate3d(${orbOffset.x}px, ${orbOffset.y - scrollY * 0.5}px, 0)`
        }}
      >
        {/* Orbe Superior Esquerdo */}
        <div
          className="absolute rounded-full"
          style={{
            width: '680px',
            height: '680px',
            left: '-180px',
            top: '-200px',
            backgroundColor: isDark ? '#24598A' : '#BFDBFE',
            opacity: isDark ? 0.65 : 0.45,
            filter: 'blur(120px)'
          }}
        />

        {/* Orbe Médio Direito */}
        <div
          className="absolute rounded-full"
          style={{
            width: '560px',
            height: '560px',
            right: '-120px',
            top: '25%',
            backgroundColor: isDark ? '#17385A' : '#93C5FD',
            opacity: isDark ? 0.75 : 0.35,
            filter: 'blur(120px)'
          }}
        />

        {/* Orbe Inferior Esquerdo (com sutil toque dourado/ciano) */}
        <div
          className="absolute rounded-full"
          style={{
            width: '460px',
            height: '460px',
            left: '10%',
            bottom: '-160px',
            backgroundColor: isDark ? '#0F7A87' : '#FDE68A',
            opacity: isDark ? 0.4 : 0.25,
            filter: 'blur(120px)'
          }}
        />
      </div>

      {/* Camada 3: Raios de luz vindos do alto (oscilação ±2°) */}
      <div
        className="absolute pointer-events-none"
        style={{
          inset: '-10% -10% 20% 30%',
          background: isDark
            ? 'repeating-linear-gradient(108deg, transparent 0px, transparent 80px, rgba(160, 220, 255, 0.04) 120px, transparent 180px)'
            : 'repeating-linear-gradient(108deg, transparent 0px, transparent 80px, rgba(255, 255, 255, 0.4) 120px, transparent 180px)',
          maskImage: 'linear-gradient(180deg, #000 0%, transparent 80%)',
          WebkitMaskImage: 'linear-gradient(180deg, #000 0%, transparent 80%)',
          animation: 'lightSweep 18s ease-in-out infinite'
        }}
      />

      {/* Camada 4: Cáusticas em duas subcamadas (60s e 90s) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40 mix-blend-screen"
        style={{
          backgroundImage: `radial-gradient(ellipse 200px 100px at 20% 30%, ${isDark ? 'rgba(70, 150, 200, 0.08)' : 'rgba(255, 255, 255, 0.35)'}, transparent),
                            radial-gradient(ellipse 300px 150px at 70% 60%, ${isDark ? 'rgba(70, 150, 200, 0.06)' : 'rgba(255, 255, 255, 0.25)'}, transparent)`,
          animation: 'causticsShiftA 60s ease-in-out infinite'
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-30 mix-blend-screen"
        style={{
          backgroundImage: `radial-gradient(ellipse 250px 120px at 60% 20%, ${isDark ? 'rgba(230, 197, 138, 0.05)' : 'rgba(184, 133, 58, 0.1)'}, transparent),
                            radial-gradient(ellipse 220px 140px at 30% 80%, ${isDark ? 'rgba(70, 150, 200, 0.07)' : 'rgba(255, 255, 255, 0.3)'}, transparent)`,
          animation: 'causticsShiftB 90s ease-in-out infinite'
        }}
      />

      {/* Camada 5: Marca d'água gigante do dragão (900px, flutuação ±8px) */}
      <div
        className="absolute right-[-120px] top-[12%] pointer-events-none transition-transform duration-300 ease-out"
        style={{
          height: '900px',
          aspectRatio: '605 / 1024',
          transform: `translate3d(${dragonOffset.x}px, ${dragonOffset.y - scrollY}px, 0)`,
          opacity: isDark ? 0.065 : 0.045
        }}
      >
        <img
          src={logoSrc}
          alt=""
          className="w-full h-full object-contain filter drop-shadow-lg"
          style={{
            animation: 'dragonFloat 12s ease-in-out infinite'
          }}
        />
      </div>

      {/* Camada 6: 3 Ondas SVG (40s, 60s, 80s) */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none overflow-hidden h-72 opacity-25">
        {/* Onda 1 */}
        <svg
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
          className="absolute bottom-0 w-[120%] h-48 left-[-10%]"
          style={{ animation: 'waveMotion 40s ease-in-out infinite' }}
        >
          <path
            d="M0,0 C300,90 600,10 900,60 C1050,85 1150,30 1200,45 L1200,120 L0,120 Z"
            fill={isDark ? 'rgba(27, 56, 90, 0.2)' : 'rgba(200, 220, 245, 0.35)'}
          />
        </svg>

        {/* Onda 2 */}
        <svg
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
          className="absolute bottom-0 w-[125%] h-40 left-[-15%]"
          style={{ animation: 'waveMotion 60s ease-in-out infinite reverse' }}
        >
          <path
            d="M0,20 C350,80 700,20 1000,70 C1100,85 1160,50 1200,60 L1200,120 L0,120 Z"
            fill={isDark ? 'rgba(15, 122, 135, 0.15)' : 'rgba(180, 210, 240, 0.3)'}
          />
        </svg>

        {/* Onda 3 */}
        <svg
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
          className="absolute bottom-0 w-[130%] h-32 left-[-10%]"
          style={{ animation: 'waveMotion 80s ease-in-out infinite' }}
        >
          <path
            d="M0,40 C250,90 550,40 850,80 C1050,100 1150,70 1200,75 L1200,120 L0,120 Z"
            fill={isDark ? 'rgba(11, 29, 51, 0.35)' : 'rgba(215, 230, 250, 0.45)'}
          />
        </svg>
      </div>

      {/* Camada 7: Neve Marinha (deriva lenta em 90s) */}
      <div
        className="absolute inset-0 opacity-55 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(1.5px 1.5px at 120px 80px, ${isDark ? 'rgba(210, 235, 250, 0.6)' : 'rgba(18, 41, 90, 0.25)'}, transparent),
            radial-gradient(1px 1px at 340px 190px, ${isDark ? 'rgba(210, 235, 250, 0.4)' : 'rgba(18, 41, 90, 0.15)'}, transparent),
            radial-gradient(2px 2px at 460px 310px, ${isDark ? 'rgba(230, 197, 138, 0.5)' : 'rgba(184, 133, 58, 0.25)'}, transparent),
            radial-gradient(1px 1px at 80px 420px, ${isDark ? 'rgba(210, 235, 250, 0.45)' : 'rgba(18, 41, 90, 0.2)'}, transparent),
            radial-gradient(1.5px 1.5px at 280px 490px, ${isDark ? 'rgba(210, 235, 250, 0.5)' : 'rgba(18, 41, 90, 0.2)'}, transparent)
          `,
          backgroundSize: '520px 520px',
          animation: 'marineSnowFall 90s linear infinite'
        }}
      />
    </div>
  );
};
