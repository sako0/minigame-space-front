import "@/styles/globals.css";
import type { AppProps } from "next/app";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className="bg-orange-200 w-screen h-screen">
      <Component {...pageProps} />
    </div>
  );
}
