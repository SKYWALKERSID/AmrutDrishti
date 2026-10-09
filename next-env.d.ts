/// <reference types="next" />
/// <reference types="next/image-types/global" />

declare module 'next/navigation' {
  export function usePathname(): string;
  export function useSearchParams(): URLSearchParams;
  export function useRouter(): {
    push(href: string): void;
    replace(href: string): void;
    back(): void;
    forward(): void;
    refresh(): void;
    prefetch(href: string): void;
  };
  export function useParams<T extends Record<string, string | string[]> = Record<string, string | string[]>>(): T;
}
