import { NextApiRequest, NextApiResponse } from 'next';

// Base URL for the MCP server backend (internal only)
const MCP_BASE_URL = process.env.SERVER_MCP_BASE_URL || 'http://localhost:7002';

// Get standardized headers for backend requests
export const getBackendHeaders = (req: NextApiRequest) => {
  // Copy relevant headers from the client request
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Forward authorization header if present
  if (req.headers.authorization) {
    headers['Authorization'] = req.headers.authorization as string;
  }

  // Forward user ID header if present
  if (req.headers['x-user-id']) {
    headers['X-User-ID'] = req.headers['x-user-id'] as string;
  }

  return headers;
};

// Proxy a GET request to the backend
export async function proxyGetRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  endpoint: string
) {
  try {
    // Construct backend URL
    const url = `${MCP_BASE_URL}${endpoint}`;
    
    // Make the request to the backend
    const response = await fetch(url, {
      headers: getBackendHeaders(req),
    });

    // Get response data
    const data = await response.json();

    // Forward the response to the client
    res.status(response.status).json(data);
  } catch (error) {
    console.error(`Error in proxy GET request to ${endpoint}:`, error);
    res.status(500).json({ 
      error: 'Failed to proxy request to backend service',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Proxy a POST request to the backend
export async function proxyPostRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  endpoint: string
) {
  try {
    // Construct backend URL
    const url = `${MCP_BASE_URL}${endpoint}`;
    
    // Make the request to the backend
    const response = await fetch(url, {
      method: 'POST',
      headers: getBackendHeaders(req),
      body: JSON.stringify(req.body),
    });

    // Get content type to determine how to handle response
    const contentType = response.headers.get('content-type');

    // For event streams, forward the response directly
    if (contentType && contentType.includes('text/event-stream')) {
      // Set headers for SSE and forward X-Stream-ID if present
      const headers: any = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no' // Prevent Nginx from buffering the response
      };
      
      // Forward X-Stream-ID if present in the backend response
      const streamId = response.headers.get('X-Stream-ID');
      if (streamId) {
        headers['X-Stream-ID'] = streamId;
      }
      
      res.writeHead(200, headers);

      // Get the response as a readable stream
      const stream = response.body;
      if (!stream) {
        throw new Error('Response body is null');
      }

      // Use streams properly with Web API
      const reader = stream.getReader();
      let decoder = new TextDecoder();
      
      // Handle client disconnect
      req.on('close', () => {
        // When client disconnects, cancel the reader to clean up resources
        reader.cancel().catch(err => {
          console.error('Error cancelling reader:', err);
        });
      });
      
      // Process the stream
      async function processStream() {
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              // End the response when the stream is done
              res.end();
              break;
            }
            
            if (value) {
              // Decode the chunk and write it directly to the response
              // This ensures we preserve the exact SSE format
              const chunk = decoder.decode(value, { stream: true });
              res.write(chunk);
            }
          }
        } catch (error) {
          console.error('Error processing stream:', error);
          res.end();
        }
      }
      
      // Start processing the stream
      processStream();
      
      return; // Return early since we're handling the response as a stream
    }

    // For JSON responses
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error(`Error in proxy POST request to ${endpoint}:`, error);
    res.status(500).json({ 
      error: 'Failed to proxy request to backend service', 
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Proxy a DELETE request to the backend
export async function proxyDeleteRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  endpoint: string
) {
  try {
    // Construct backend URL
    const url = `${MCP_BASE_URL}${endpoint}`;
    
    // Make the request to the backend
    const response = await fetch(url, {
      method: 'DELETE',
      headers: getBackendHeaders(req),
    });

    // Get response data
    const data = await response.json();

    // Forward the response to the client
    res.status(response.status).json(data);
  } catch (error) {
    console.error(`Error in proxy DELETE request to ${endpoint}:`, error);
    res.status(500).json({ 
      error: 'Failed to proxy request to backend service',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
