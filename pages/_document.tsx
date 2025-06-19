import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en" data-theme="light">
      <Head>
        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />

        {/* Social Sharing Meta Tags */}
        <meta property="og:title" content="Smart-Takhli แจ้งทุกข์-แจ้งเหตุ" />
        <meta property="og:description" content="ระบบยืมอุปกรณ์กายภาพ สำหรับประชาชน" />
        <meta property="og:image" content="https://smart-takhli.app/preview.jpg" />
        <meta property="og:url" content="https://smart-takhli.app" />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
