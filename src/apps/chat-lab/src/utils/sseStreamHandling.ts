/**
 * Handle an OpenAPI-compatible SSE stream and yield chunks.
 * As with other OpenAPI-compatible SSE streams, it only looks at single-line
 * `data: {...}` chunks and finishes when it sees a `[DONE]` chunk.
 *
 * Assumes the body is from a response that has already been checked to be ok.
 *
 * @param body - The body of the SSE stream
 * @param parseChunk - A function to parse the chunk
 * @returns An async generator that yields the chunks
 */
export async function* handleSSEStream<T>(
  body: ReadableStream<Uint8Array>,
  parseChunk: (chunk: string) => T = JSON.parse
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) {
          continue;
        }

        // OpenRouter uses Server-Sent Events format: "data: {...}"
        if (trimmedLine.startsWith('data: ')) {
          const dataStr = trimmedLine.slice(6); // Remove "data: " prefix

          if (dataStr === '[DONE]') {
            return; // End of stream
          }

          try {
            const chunk = parseChunk(dataStr);
            yield chunk;
          } catch (parseError) {
            console.warn('Failed to parse stream chunk:', {
              dataStr,
              error: parseError,
            });
            // Continue processing other chunks
          }
        }
      }
    }

    // Process any remaining data in buffer
    if (buffer.trim()) {
      const trimmedLine = buffer.trim();
      if (trimmedLine.startsWith('data: ')) {
        const dataStr = trimmedLine.slice(6);
        if (dataStr !== '[DONE]') {
          try {
            const chunk = parseChunk(dataStr);
            yield chunk;
          } catch (parseError) {
            console.warn('Failed to parse final stream chunk:', {
              dataStr,
              error: parseError,
            });
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
