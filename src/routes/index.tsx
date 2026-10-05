import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { INGREDIENTS, layerStart, type BurgerState } from "@/lib/burger-data";

// A cena 3D usa WebGL, então é carregada sob demanda e só no navegador.
// Se o carregamento falhar, a página continua visível (sem a cena) em vez de ficar em branco.
const NoScene = (_: { state: unknown }) => null;
const BurgerScene = lazy(() =>
  import("@/components/BurgerScene")
    .then((m) => ({ default: m.default ?? NoScene }))
    .catch((err) => {
      console.warn("Falha ao carregar a cena 3D:", err instanceof Error ? err.message : err);
      return { default: NoScene };
    }),
);

const DESCRIPTION =
  "Hamburgueria artesanal grelhada na brasa. Role a página e veja o burger ser montado camada por camada.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Brasa Burger — Hamburgueria artesanal" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Brasa Burger — Hamburgueria artesanal" },
      { property: "og:description", content: DESCRIPTION },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600&display=swap",
      },
    ],
  }),
  component: Index,
});

const DISPLAY = '"Anton", Impact, "Arial Narrow", sans-serif';
const BODY = '"Inter", system-ui, sans-serif';

// Troque pelo número real da hamburgueria (DDI + DDD + número, só dígitos).
const WHATSAPP = "https://wa.me/5500000000000?text=Oi!%20Quero%20fazer%20um%20pedido";

const STEPS = [
  {
    kicker: "Passo 01",
    title: "Tudo começa na chapa",
    text: "Pão brioche tostado na manteiga e um blend de 180 g grelhado na brasa, suculento por dentro e selado por fora.",
  },
  {
    kicker: "Passo 02",
    title: "Cheddar derretendo, bacon estalando",
    text: "Cheddar cremoso escorrendo pela carne e fatias de bacon crocante, assadas até o ponto exato.",
  },
  {
    kicker: "Passo 03",
    title: "Fresco de verdade",
    text: "Alface crespa colhida no dia e tomate fatiado na hora. Nada de ingrediente cansado.",
  },
  {
    kicker: "Passo 04",
    title: "O toque que equilibra",
    text: "Cebola roxa fininha e picles crocantes para cortar a gordura e deixar cada mordida mais viva.",
  },
  {
    kicker: "Passo 05",
    title: "Molho da casa, segunda carne",
    text: "Nossa receita secreta de molho defumado e mais uma carne na brasa. Aqui ninguém passa fome.",
  },
  {
    kicker: "Passo 06",
    title: "A coroa",
    text: "Mais cheddar e o pão com gergelim tostado para fechar. Está pronto para ir direto à sua mesa.",
  },
];

const MENU = [
  {
    name: "Brasa Clássico",
    desc: "1 carne, cheddar, alface, tomate e molho da casa",
    price: "R$ 32",
  },
  {
    name: "Duplo Bacon",
    desc: "2 carnes, cheddar duplo, bacon crocante e cebola roxa",
    price: "R$ 42",
  },
  {
    name: "Brasa Supremo",
    desc: "O burger completo da animação, com tudo que você viu",
    price: "R$ 49",
  },
];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function Index() {
  const state = useRef<BurgerState>({
    scroll: 0,
    assemble: 0,
    finale: 0,
    shift: 0,
    mouseX: 0,
    mouseY: 0,
  });
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    setMounted(true);
    const update = () => {
      const vh = window.innerHeight;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - vh;
      const s = state.current;
      s.scroll = max > 0 ? clamp01(y / max) : 0;
      // A montagem acontece entre 0,5 e 6,5 telas de rolagem.
      s.assemble = clamp01((y - 0.5 * vh) / (6 * vh));
      s.finale = clamp01((y - 6.3 * vh) / (0.8 * vh));
      // Em telas largas, o burger sai para o lado oposto ao cartão de texto.
      const sec = Math.floor((y + 0.5 * vh) / vh) - 1;
      const wide = window.innerWidth >= 768;
      s.shift = wide && sec >= 0 && sec < STEPS.length ? (sec % 2 === 0 ? 1 : -1) : 0;
      const count = INGREDIENTS.filter((_, i) => s.assemble > layerStart(i)).length;
      setActive((prev) => (prev === count ? prev : count));
    };
    const onMove = (e: PointerEvent) => {
      state.current.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      state.current.mouseY = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  const current = active > 0 ? INGREDIENTS[active - 1] : undefined;

  return (
    <main
      className="relative text-[#fff4e0]"
      style={{ backgroundColor: "#0b0605", fontFamily: BODY }}
    >
      {/* Cena 3D fixa ao fundo */}
      <div className="fixed inset-0 z-0">
        {mounted && (
          <Suspense fallback={null}>
            <BurgerScene state={state} />
          </Suspense>
        )}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 38%, rgba(255,106,26,0.14) 0%, transparent 55%), radial-gradient(ellipse at center, transparent 45%, rgba(11,6,5,0.85) 100%)",
          }}
        />
      </div>

      {/* Cabeçalho */}
      <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between px-5 py-4 md:px-12 md:py-6">
        <span className="text-2xl tracking-wider md:text-3xl" style={{ fontFamily: DISPLAY }}>
          BRASA<span className="text-[#ff6a1a]">.</span>BURGER
        </span>
        <nav className="flex items-center gap-5 text-sm font-medium">
          <a href="#cardapio" className="hidden text-white/70 transition hover:text-white sm:block">
            Cardápio
          </a>
          <a
            href={WHATSAPP}
            className="rounded-full bg-[#e8281c] px-5 py-2 font-semibold text-white shadow-lg shadow-[#e8281c]/30 transition hover:bg-[#ff3b2e]"
          >
            Pedir agora
          </a>
        </nav>
      </header>

      {/* Indicador da camada atual */}
      {current && (
        <div
          aria-live="polite"
          className="fixed top-20 right-5 z-30 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 backdrop-blur-md md:top-24 md:right-12"
        >
          <p className="text-[10px] tracking-[0.3em] text-[#ff8a1f] uppercase">
            Camada {String(active).padStart(2, "0")} / {INGREDIENTS.length}
          </p>
          <p className="mt-1 text-lg leading-none" style={{ fontFamily: DISPLAY }}>
            {current.name}
          </p>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#ff8a1f] to-[#e8281c] transition-all duration-300"
              style={{ width: `${(active / INGREDIENTS.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="relative z-10">
        {/* Hero */}
        <section className="flex min-h-screen flex-col items-center justify-end px-6 pb-16 text-center md:pb-20">
          <p className="mb-3 text-xs tracking-[0.35em] text-[#ff8a1f] uppercase">
            Hamburgueria artesanal · Grelhado na brasa
          </p>
          <h1
            className="text-[22vw] leading-[0.85] tracking-wide md:text-[12rem]"
            style={{ fontFamily: DISPLAY }}
          >
            <span className="bg-gradient-to-b from-[#fff4e0] via-[#ffb347] to-[#e8281c] bg-clip-text text-transparent">
              BRASA
            </span>
          </h1>
          <p className="mt-5 max-w-md text-base text-white/70 md:text-lg">
            Role a página e veja o seu burger ser montado, camada por camada.
          </p>
          <div className="mt-8 flex flex-col items-center gap-2 text-xs tracking-widest text-white/50 uppercase">
            <span>Role para começar</span>
            <span className="block h-10 w-px animate-pulse bg-gradient-to-b from-[#ff8a1f] to-transparent" />
          </div>
        </section>

        {/* Passos da montagem */}
        {STEPS.map((s, i) => (
          <section
            key={s.title}
            className={`flex min-h-screen items-end px-5 pb-12 md:px-16 md:pb-16 ${
              i % 2 ? "md:justify-end" : "md:justify-start"
            }`}
          >
            <div
              className={`w-full max-w-md rounded-3xl border border-white/10 bg-black/45 p-6 backdrop-blur-md md:p-8 ${
                i % 2 ? "md:text-right" : ""
              }`}
            >
              <p className="mb-2 text-xs tracking-[0.3em] text-[#ff8a1f] uppercase">{s.kicker}</p>
              <h2
                className="mb-3 text-4xl leading-none md:text-5xl"
                style={{ fontFamily: DISPLAY }}
              >
                {s.title}
              </h2>
              <p className="text-sm text-white/75 md:text-base">{s.text}</p>
            </div>
          </section>
        ))}

        {/* Final, tela 1: burger pronto */}
        <section className="flex min-h-screen flex-col items-center justify-end px-5 pb-14 text-center md:pb-16">
          <h2 className="text-5xl leading-[0.9] md:text-7xl" style={{ fontFamily: DISPLAY }}>
            <span className="bg-gradient-to-b from-[#fff4e0] to-[#ff8a1f] bg-clip-text text-transparent">
              PRONTO.
            </span>{" "}
            AGORA É COM VOCÊ.
          </h2>
          <p className="mt-3 text-sm text-white/60">Veja o cardápio logo abaixo ↓</p>
        </section>

        {/* Final, tela 2: cardápio e pedido */}
        <section
          id="cardapio"
          className="flex min-h-screen flex-col items-center justify-end bg-gradient-to-b from-transparent via-[#0b0605]/85 to-[#0b0605] px-5 pt-24 pb-12 text-center md:px-16"
        >
          <h2 className="mb-6 text-4xl md:text-6xl" style={{ fontFamily: DISPLAY }}>
            ESCOLHA O SEU
          </h2>
          <div className="grid w-full max-w-5xl gap-4 md:grid-cols-3">
            {MENU.map((m) => (
              <article
                key={m.name}
                className="rounded-3xl border border-white/10 bg-black/60 p-6 text-left backdrop-blur-md transition hover:border-[#ff8a1f]/60"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-2xl" style={{ fontFamily: DISPLAY }}>
                    {m.name}
                  </h3>
                  <span className="text-lg font-semibold text-[#ff8a1f]">{m.price}</span>
                </div>
                <p className="mt-2 text-sm text-white/65">{m.desc}</p>
              </article>
            ))}
          </div>
          <a
            id="pedir"
            href={WHATSAPP}
            className="mt-8 inline-block rounded-full bg-gradient-to-r from-[#ff8a1f] to-[#e8281c] px-10 py-4 text-lg font-semibold text-white shadow-xl shadow-[#e8281c]/30 transition hover:scale-105"
          >
            Pedir pelo WhatsApp
          </a>
          <p className="mt-10 text-xs text-white/40">
            © {new Date().getFullYear()} Brasa Burger · Aberto todos os dias, das 18h às 23h
          </p>
        </section>
      </div>
    </main>
  );
}
