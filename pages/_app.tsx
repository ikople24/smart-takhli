import "@/styles/globals.css";
import "sweetalert2/dist/sweetalert2.min.css";
import type { AppProps } from "next/app";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { useEffect } from "react";

function AppContent({ Component, pageProps }: AppProps) {
  const { userId, isLoaded } = useAuth();
  const router = useRouter();

  const isProtected = ["/admin"].some((path) =>
    router.pathname.startsWith(path)
  );

  useEffect(() => {
    if (isLoaded && isProtected && !userId) {
      router.replace("/");
    }
  }, [isLoaded, isProtected, userId, router]);

  if (isProtected && (!isLoaded || !userId)) {
    return <div className="p-8 text-center">กำลังโหลด...</div>;
  }

  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
}

export default function App(props: AppProps) {
  return (
    <ClerkProvider {...props.pageProps}>
      <AppContent {...props} />
    </ClerkProvider>
  );
}
