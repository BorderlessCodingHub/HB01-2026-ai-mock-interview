import { env } from "@/config/env";
import type {
  ISpeechToText,
  SpeechToTextInput,
  SpeechToTextResult,
} from "@/modules/transcribe/protocols/speech-to-text";
import { logger } from "@/shared/logger";
import {
  BadGatewayError,
  BadRequestError,
  GatewayTimeoutError,
} from "@/shared/errors/http-errors";

const ASSEMBLYAI_API_URL = "https://api.assemblyai.com/v2";
export const TRANSCRIBE_POLL_INTERVAL_MS = 1_500;
export const TRANSCRIBE_TIMEOUT_MS = 60_000;

type Sleep = (milliseconds: number) => Promise<void>;

export class AssemblyAiSpeechToTextAdapter implements ISpeechToText {
  constructor(
    private readonly fetchFn: typeof fetch = globalThis.fetch,
    private readonly sleep: Sleep = defaultSleep,
    private readonly now: () => number = Date.now,
  ) {}

  async transcribe(input: SpeechToTextInput): Promise<SpeechToTextResult> {
    const upload = await this.requestJson(
      `${ASSEMBLYAI_API_URL}/upload`,
      {
        method: "POST",
        headers: this.headers(input.mimeType),
        body: input.audio,
      },
    );
    const uploadUrl = getString(upload, "upload_url");

    if (uploadUrl === undefined) {
      throw new BadGatewayError("Speech-to-text provider returned an invalid upload");
    }

    const transcript = await this.requestJson(
      `${ASSEMBLYAI_API_URL}/transcript`,
      {
        method: "POST",
        headers: this.headers("application/json"),
        body: JSON.stringify({
          audio_url: uploadUrl,
          language_detection: true,
          language_detection_options: {
            expected_languages: ["pt", "en"],
            fallback_language: "auto",
          },
        }),
      },
    );
    const transcriptId = getString(transcript, "id");

    if (transcriptId === undefined) {
      throw new BadGatewayError(
        "Speech-to-text provider returned an invalid transcript",
      );
    }

    return this.pollTranscript(transcriptId);
  }

  private async pollTranscript(
    transcriptId: string,
  ): Promise<SpeechToTextResult> {
    const startedAt = this.now();

    while (this.now() - startedAt < TRANSCRIBE_TIMEOUT_MS) {
      const transcript = await this.requestJson(
        `${ASSEMBLYAI_API_URL}/transcript/${transcriptId}`,
        { headers: this.headers() },
      );
      const status = getString(transcript, "status");

      if (status === "completed") {
        return this.toResult(transcript);
      }

      if (status === "error") {
        const providerError =
          getString(transcript, "error") ?? "unknown error";
        logger.warn("Speech-to-text provider returned an error status", {
          transcriptId,
          providerError,
        });

        if (providerError.toLowerCase().includes("no spoken audio")) {
          throw new BadRequestError(
            "No speech detected in the recording. Please try again.",
          );
        }

        throw new BadGatewayError("Speech-to-text provider failed");
      }

      await this.sleep(TRANSCRIBE_POLL_INTERVAL_MS);
    }

    throw new GatewayTimeoutError("Speech-to-text provider timed out");
  }

  private async requestJson(url: string, init: RequestInit): Promise<unknown> {
    try {
      const response = await this.fetchFn(url, init);

      if (!response.ok) {
        throw new BadGatewayError("Speech-to-text provider request failed");
      }

      return await response.json();
    } catch (error) {
      if (error instanceof BadGatewayError) {
        throw error;
      }

      throw new BadGatewayError("Speech-to-text provider request failed");
    }
  }

  private toResult(transcript: unknown): SpeechToTextResult {
    const text = getString(transcript, "text");
    const languageCode = getString(transcript, "language_code");
    const languageConfidence = getNumber(transcript, "language_confidence");

    if (
      text === undefined ||
      languageCode === undefined ||
      languageConfidence === undefined
    ) {
      throw new BadGatewayError(
        "Speech-to-text provider returned an invalid transcript",
      );
    }

    return { text, languageCode, languageConfidence };
  }

  private headers(contentType?: string): Record<string, string> {
    return {
      authorization: env.ASSEMBLYAI_API_KEY,
      ...(contentType === undefined ? {} : { "content-type": contentType }),
    };
  }
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getString(value: unknown, key: string): string | undefined {
  if (!isRecord(value) || typeof value[key] !== "string") {
    return undefined;
  }

  return value[key];
}

function getNumber(value: unknown, key: string): number | undefined {
  if (!isRecord(value) || typeof value[key] !== "number") {
    return undefined;
  }

  return value[key];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
