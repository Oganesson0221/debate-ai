# Speech-to-Text Configuration Guide

This document explains how to configure and use the speech-to-text functionality in DebateAI.

## Overview

DebateAI supports two speech-to-text providers:

1. **Forge API** (Primary) - Internal Whisper API service
2. **Hugging Face** (Fallback) - Uses OpenAI Whisper models hosted on Hugging Face

The system automatically selects the best available provider, with Forge as the primary choice and Hugging Face as a fallback.

## Quick Start

### Option 1: Using Hugging Face (Recommended for Development)

1. Get a free API key from [Hugging Face](https://huggingface.co/settings/tokens)
2. Create a `.env` file in the project root:

```bash
cp .env.example .env
```

3. Add your Hugging Face API key:

```env
HUGGINGFACE_API_KEY=hf_your_api_key_here
```

4. (Optional) Choose a Whisper model:

```env
HUGGINGFACE_MODEL=openai/whisper-large-v3-turbo
```

### Option 2: Using Forge API

If you have access to the Forge API:

```env
BUILT_IN_FORGE_API_URL=https://forge.manus.im
BUILT_IN_FORGE_API_KEY=your-forge-api-key
```

## Available Whisper Models

| Model | Speed | Accuracy | Best For |
|-------|-------|----------|----------|
| `openai/whisper-large-v3` | Slowest | Highest | Production, accuracy-critical |
| `openai/whisper-large-v3-turbo` | Fast | High | **Recommended** - Best balance |
| `openai/whisper-small` | Medium | Medium | Development, testing |
| `openai/whisper-base` | Fast | Lower | Quick prototyping |
| `openai/whisper-tiny` | Fastest | Lowest | Real-time applications |

## API Usage

### Check Transcription Status

```typescript
// Using tRPC client
const status = await trpc.transcription.status.query();
console.log(status);
// {
//   forgeAvailable: boolean,
//   huggingFaceAvailable: boolean,
//   activeProvider: 'forge' | 'huggingface' | null
// }
```

### Transcribe Audio

```typescript
// Using tRPC client
const result = await trpc.speech.transcribe.mutate({
  audioUrl: 'https://example.com/audio.mp3',
  speechId: 123,
  useHuggingFace: false, // Optional: force Hugging Face
});

console.log(result.transcript);
console.log(result.segments); // Timestamped segments
```

## Supported Audio Formats

- MP3 (audio/mpeg)
- WAV (audio/wav)
- WebM (audio/webm)
- OGG (audio/ogg)
- M4A (audio/m4a, audio/mp4)

## File Size Limits

- **Forge API**: 16MB maximum
- **Hugging Face**: 25MB maximum

## Troubleshooting

### "Model is loading" Error

When using Hugging Face, the first request may take 20-30 seconds while the model loads into memory. Subsequent requests will be faster.

### No Transcription Provider Available

Ensure you have set at least one of:
- `HUGGINGFACE_API_KEY` or `HF_TOKEN`
- `BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY`

## MindSpeak Logic Context

This application is designed to support debate training in the style of [MindSpeak Logic](https://www.mindspeaklogic.org/), focusing on:

- **Critical Thinking**: Analyzing arguments and detecting logical flaws
- **Logical Reasoning**: Building structured arguments (claim-mechanism-impact)
- **Oratorical Excellence**: Delivering persuasive speeches

The speech-to-text functionality enables:
- Real-time transcription during debates
- Post-debate analysis and feedback
- Argument extraction and quality scoring
- Progress tracking over time

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │ Web Speech API  │    │ Audio Recording (MediaRecorder) │ │
│  │ (Real-time)     │    │ → Upload to S3 → Server STT     │ │
│  └─────────────────┘    └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         Server                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              voiceTranscription.ts                       ││
│  │  ┌─────────────┐    ┌──────────────────────────────────┐││
│  │  │ Forge API   │ OR │ Hugging Face Whisper API         │││
│  │  │ (Primary)   │    │ (Fallback)                       │││
│  │  └─────────────┘    └──────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Related Files

- `server/_core/voiceTranscription.ts` - Main transcription logic
- `server/_core/huggingfaceTranscription.ts` - Hugging Face integration
- `server/routers.ts` - API endpoints
- `client/src/pages/DebateRoom.tsx` - Frontend integration
- `.env.example` - Configuration template
