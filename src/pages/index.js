import PixiGame from "@/components/PixiGame";
import Head from "next/head";
import { useState } from "react";

export default function Home() {
  const [canvasRect, setCanvasRect] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });

  return (
    <>
      <Head>
        <title>Animnation Tests</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div style={{ position: "relative", width: "100%", height: "100vh" }}>
        <PixiGame onCanvasBoundsChange={setCanvasRect} />
      </div>
    </>
  );
}
