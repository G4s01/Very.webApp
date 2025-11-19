import Document, { Html, Head, Main, NextScript } from 'next/document';

class MyDocument extends Document {
  render() {
    return (
      <Html lang="it">
        <Head>
          {/* Standard favicons */}
          <link rel="icon" href="/favicon.ico" />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
          <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />

          {/* Apple / PWA */}
          <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
          <link rel="manifest" href="/site.webmanifest" />

          {/* Android / Chrome explicit icons */}
          <link rel="icon" type="image/png" sizes="192x192" href="/android-chrome-192x192.png" />
          <link rel="icon" type="image/png" sizes="512x512" href="/android-chrome-512x512.png" />

          {/* Microsoft tile */}
          <meta name="msapplication-TileColor" content="#0a5d36" />
          <meta name="msapplication-TileImage" content="/mstile-150x150.png" />

          {/* Theme color */}
          <meta name="theme-color" content="#0a5d36" />

          {/* Safari pinned tab (optional). Use an SVG that works as a mask. */}
          <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#0a5d36" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;