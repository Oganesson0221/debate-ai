/**
 * Hugging Face-based Voice Transcription
 * 
 * This module provides an alternative speech-to-text implementation using
 * Hugging Face's Inference API with OpenAI Whisper models.
 * 
 * Supported models:
 * - openai/whisper-large-v3 (highest accuracy)
 * - openai/whisper-large-v3-turbo (faster, good accuracy)
 * - openai/whisper-small (lightweight)
 * - openai/whisper-base (fastest, lower accuracy)
 * 
 * Environment Variables:
 * - HUGGINGFACE_API_KEY: Your Hugging Face API token
 * - HUGGINGFACE_MODEL: Model to use (default: openai/whisper-large-v3-turbo)
 */

import { ENV } from "./env";

export type HFTranscribeOptions = {
  audioUrl: string;
  model?: string;
  language?: string;
};

export type HFTranscriptionResponse = {
  text: string;
  language?: string;
  duration?: number;
  chunks?: Array<{
    text: string;
    timestamp: [number, number];
  }>;
};

export type HFTranscriptionError = {
  error: string;
  code: "FILE_TOO_LARGE" | "INVALID_FORMAT" | "TRANSCRIPTION_FAILED" | "SERVICE_ERROR" | "API_KEY_MISSING";
  details?: string;
};

// Get HuggingFace API key from environment
const getHFApiKey = (): string | undefined => {
  return process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN;
};

// Get model from environment or use default
const getHFModel = (): string => {
  return process.env.HUGGINGFACE_MODEL || "openai/whisper-large-v3-turbo";
};

/**
 * Transcribe audio using Hugging Face Inference API
 */
export async function transcribeWithHuggingFace(
  options: HFTranscribeOptions
): Promise<HFTranscriptionResponse | HFTranscriptionError> {
  const apiKey = getHFApiKey();
  
  if (!apiKey) {
    return {
      error: "Hugging Face API key is not configured",
      code: "API_KEY_MISSING",
      details: "Set HUGGINGFACE_API_KEY or HF_TOKEN environment variable"
    };
  }

  const model = options.model || getHFModel();
  
  try {
    // Step 1: Download audio from URL
    let audioBuffer: ArrayBuffer;
    let mimeType: string;
    
    try {
      const response = await fetch(options.audioUrl);
      if (!response.ok) {
        return {
          error: "Failed to download audio file",
          code: "INVALID_FORMAT",
          details: `HTTP ${response.status}: ${response.statusText}`
        };
      }
      
      audioBuffer = await response.arrayBuffer();
      mimeType = response.headers.get('content-type') || 'audio/mpeg';
      
      // Check file size (25MB limit for HF API)
      const sizeMB = audioBuffer.byteLength / (1024 * 1024);
      if (sizeMB > 25) {
        return {
          error: "Audio file exceeds maximum size limit",
          code: "FILE_TOO_LARGE",
          details: `File size is ${sizeMB.toFixed(2)}MB, maximum allowed is 25MB`
        };
      }
    } catch (error) {
      return {
        error: "Failed to fetch audio file",
        code: "SERVICE_ERROR",
        details: error instanceof Error ? error.message : "Unknown error"
      };
    }

    // Step 2: Call Hugging Face Inference API
    const hfApiUrl = `https://api-inference.huggingface.co/models/${model}`;
    
    const response = await fetch(hfApiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": mimeType,
      },
      body: audioBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      
      // Handle model loading state
      if (response.status === 503) {
        return {
          error: "Model is loading, please try again in a few seconds",
          code: "SERVICE_ERROR",
          details: "The model is being loaded into memory. Retry after 20-30 seconds."
        };
      }
      
      return {
        error: "Transcription service request failed",
        code: "TRANSCRIPTION_FAILED",
        details: `${response.status} ${response.statusText}${errorText ? `: ${errorText}` : ""}`
      };
    }

    // Step 3: Parse response
    const result = await response.json();
    
    // HF Whisper API returns { text: string } or { text: string, chunks: [...] }
    if (typeof result === 'object' && 'text' in result) {
      return {
        text: result.text,
        language: options.language,
        chunks: result.chunks,
      };
    }
    
    // Handle unexpected response format
    if (typeof result === 'string') {
      return {
        text: result,
        language: options.language,
      };
    }

    return {
      error: "Invalid transcription response",
      code: "SERVICE_ERROR",
      details: "Unexpected response format from Hugging Face API"
    };

  } catch (error) {
    return {
      error: "Voice transcription failed",
      code: "SERVICE_ERROR",
      details: error instanceof Error ? error.message : "An unexpected error occurred"
    };
  }
}

/**
 * Helper to convert HF response to Whisper-compatible format
 * for compatibility with existing code
 */
export function convertToWhisperFormat(hfResponse: HFTranscriptionResponse): {
  task: "transcribe";
  language: string;
  duration: number;
  text: string;
  segments: Array<{
    id: number;
    seek: number;
    start: number;
    end: number;
    text: string;
    tokens: number[];
    temperature: number;
    avg_logprob: number;
    compression_ratio: number;
    no_speech_prob: number;
  }>;
} {
  const segments = hfResponse.chunks?.map((chunk, index) => ({
    id: index,
    seek: 0,
    start: chunk.timestamp[0],
    end: chunk.timestamp[1],
    text: chunk.text,
    tokens: [],
    temperature: 0,
    avg_logprob: 0,
    compression_ratio: 0,
    no_speech_prob: 0,
  })) || [];

  return {
    task: "transcribe",
    language: hfResponse.language || "en",
    duration: hfResponse.duration || 0,
    text: hfResponse.text,
    segments,
  };
}

/**
 * Check if Hugging Face transcription is available
 */
export function isHuggingFaceAvailable(): boolean {
  return !!getHFApiKey();
}

/**
 * Get available Whisper models from Hugging Face
 */
export const AVAILABLE_WHISPER_MODELS = [
  {
    id: "openai/whisper-large-v3",
    name: "Whisper Large V3",
    description: "Highest accuracy, slowest",
    downloads: "6.6M",
  },
  {
    id: "openai/whisper-large-v3-turbo",
    name: "Whisper Large V3 Turbo",
    description: "Fast with good accuracy (recommended)",
    downloads: "2.7M",
  },
  {
    id: "openai/whisper-small",
    name: "Whisper Small",
    description: "Balanced speed and accuracy",
    downloads: "1.5M",
  },
  {
    id: "openai/whisper-base",
    name: "Whisper Base",
    description: "Fast, lower accuracy",
    downloads: "1.2M",
  },
  {
    id: "openai/whisper-tiny",
    name: "Whisper Tiny",
    description: "Fastest, lowest accuracy",
    downloads: "474.6K",
  },
];
