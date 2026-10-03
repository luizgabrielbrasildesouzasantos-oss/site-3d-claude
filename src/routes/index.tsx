import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { SceneState } from "@/components/Scene3D";

// A cena 3D só roda no navegador (WebGL), então é carregada sob demanda no cliente.
const Scene3D = lazy(() => import("@/components/Scene3D"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Site 3D animado" },
      {
        name: "description",
        content: "Experiência 3D animada com scroll, feita com React e Three.js.",
      },
      { property: "og:title", content: "Site 3D animado" },
      {
        property: "og:description",
        content: "Experiência 3D animada com scroll, feita com React e Three.js.",
      },
    ],
  }),
  component: Index,
});

const SECTIONS = [
  {
    kicker: "01 — Início",
    title: "Um universo em movimento",
    text: "Role a página e acompanhe a câmera orbitando o núcleo. Mexa o mouse para mudar a perspectiva.",
  },
  {
    kicker: "02 — Forma viva",
    title: "Geometria que respira",
    text: "O núcleo central é deformado em tempo real por ondas, enquanto anéis e partículas giram ao redor.",
  },
  {
    kicker: "03 — Interativo",
    title: "Feito com React + Three.js",
    text: "Tudo roda no navegador via WebGL, dentro de um projeto Lovable sincronizado com o GitHub.",
  },
];

function Index() {
  const state = useRef<SceneState>({ scroll: 0, mouseX: 0, mouseY: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      state.current.scroll = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    };
    const onMove = (e: PointerEvent) => {
      state.current.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      state.current.mouseY = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <main className="relative text-white" style={{ backgroundColor: "#05030f" }}>
      <div className="fixed inset-0 z-0">
        {mounted && (
          <Suspense fallback={null}>
            <Scene3D state={state} />
          </Suspense>
        )}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 40%, rgba(5,3,15,0.85) 100%)",
          }}
        />
      </div>

      <header className="fixed inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-5 md:px-12">
        <span className="text-sm font-semibold tracking-[0.3em] uppercase">Site 3D</span>
        <span className="text-xs text-white/60">role para explorar ↓</span>
      </header>

      <div className="relative z-10">
        {SECTIONS.map((s, i) => (
          <section
            key={s.title}
            className={`flex min-h-screen items-center px-6 md:px-16 ${i % 2 ? "justify-end text-right" : "justify-start"}`}
          >
            <div className="max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md">
              <p className="mb-3 text-xs tracking-[0.3em] text-cyan-300 uppercase">{s.kicker}</p>
              <h1 className="mb-4 text-4xl leading-tight font-bold md:text-6xl">
                <span className="bg-gradient-to-r from-violet-400 via-cyan-300 to-pink-400 bg-clip-text text-transparent">
                  {s.title}
                </span>
              </h1>
              <p className="text-base text-white/75 md:text-lg">{s.text}</p>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
