import { useSyncExternalStore, type ComponentProps } from "react";
const subscribe = (notify: () => void) => {
  window.addEventListener("popstate", notify);
  return () => window.removeEventListener("popstate", notify);
};
const snapshot = () => window.location.href;
function navigate(href: string, replace = false) {
  window.history[replace ? "replaceState" : "pushState"]({}, "", href);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
export function usePathname() {
  return new URL(useSyncExternalStore(subscribe, snapshot)).pathname;
}
export function useSearchParams() {
  return new URL(useSyncExternalStore(subscribe, snapshot)).searchParams;
}
export function useRouter() {
  return {
    push: (href: string) => navigate(href),
    replace: (href: string) => navigate(href, true),
  };
}
export default function Link({
  href,
  children,
  onClick,
  ...props
}: ComponentProps<"a">) {
  return (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (
          href?.startsWith("/") &&
          !event.defaultPrevented &&
          !event.metaKey &&
          !event.ctrlKey
        ) {
          event.preventDefault();
          navigate(href);
        }
      }}
    >
      {children}
    </a>
  );
}
