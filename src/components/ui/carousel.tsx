"use client";

import {
  createContext,
  useContext,
  useEffect,
  type ComponentProps,
  type ReactNode,
} from "react";
import useEmblaCarousel from "embla-carousel-react";

export type CarouselApi = ReturnType<typeof useEmblaCarousel>[1];
type CarouselOptions = Parameters<typeof useEmblaCarousel>[0];
type CarouselPlugins = Parameters<typeof useEmblaCarousel>[1];

const CarouselContext = createContext<{
  viewportRef: ReturnType<typeof useEmblaCarousel>[0];
} | null>(null);

function useCarousel() {
  const context = useContext(CarouselContext);
  if (!context) throw new Error("CarouselContent must be inside Carousel");
  return context;
}

export function Carousel({
  children,
  opts,
  plugins,
  setApi,
  onKeyDownCapture,
  ...props
}: ComponentProps<"div"> & {
  children: ReactNode;
  opts?: CarouselOptions;
  plugins?: CarouselPlugins;
  setApi?: (api: CarouselApi) => void;
}) {
  const [viewportRef, api] = useEmblaCarousel(opts, plugins);

  useEffect(() => {
    setApi?.(api);
  }, [api, setApi]);

  return (
    <CarouselContext.Provider value={{ viewportRef }}>
      <div
        role="region"
        aria-roledescription="carousel"
        data-slot="carousel"
        {...props}
        onKeyDownCapture={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            api?.scrollPrev();
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            api?.scrollNext();
          }
          onKeyDownCapture?.(event);
        }}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  );
}

export function CarouselContent({
  children,
  className,
  viewportClassName,
  ...props
}: ComponentProps<"div"> & { viewportClassName?: string }) {
  const { viewportRef } = useCarousel();
  return (
    <div
      ref={viewportRef}
      className={viewportClassName}
      data-slot="carousel-viewport"
    >
      <div data-slot="carousel-content" className={className} {...props}>
        {children}
      </div>
    </div>
  );
}

export function CarouselItem(props: ComponentProps<"div">) {
  return (
    <div
      role="group"
      aria-roledescription="slide"
      data-slot="carousel-item"
      {...props}
    />
  );
}
