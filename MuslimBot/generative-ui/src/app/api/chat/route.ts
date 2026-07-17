export async function POST(req: Request) {
  const { messages } = await req.json();
  const lastMessage = messages[messages.length - 1].content;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Create data stream protocol chunks
      const response = `I am the MuslimBot Generative OS. I received your request: "${lastMessage}".\n\nThis is a mock streaming response since we are currently in the Frontend UI Blueprint phase. Once connected to the real backend, I will generate charts, query ERPNext, and orchestrate n8n workflows for you.`;
      
      const chunks = response.split(' ');
      for (const chunk of chunks) {
        // useChat from @ai-sdk/react expects a specific format: "0:text\n" for text chunks
        const textChunk = `0:${JSON.stringify(chunk + ' ')}\n`;
        controller.enqueue(encoder.encode(textChunk));
        await new Promise(r => setTimeout(r, 50));
      }
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'x-vercel-ai-data-stream': 'v1'
    }
  });
}
