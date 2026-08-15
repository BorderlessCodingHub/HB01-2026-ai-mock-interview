import { describe, expect, it, vi } from "vitest";

import {
  BadGatewayError,
  BadRequestError,
  GatewayTimeoutError,
} from "@/shared/errors/http-errors";

import {
  AssemblyAiSpeechToTextAdapter,
  TRANSCRIBE_POLL_INTERVAL_MS,
  TRANSCRIBE_TIMEOUT_MS,
} from "./assemblyai-speech-to-text-adapter";

const input = {
  audio: Buffer.from("audio"),
  mimeType: "audio/webm",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("AssemblyAiSpeechToTextAdapter", () => {
  it("uploads audio, creates a language-detected transcript and returns it when completed", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ upload_url: "https://upload.test/audio" }))
      .mockResolvedValueOnce(jsonResponse({ id: "transcript-id" }))
      .mockResolvedValueOnce(
        jsonResponse({
          status: "completed",
          text: "Olá, world",
          language_code: "pt",
          language_confidence: 0.98,
        }),
      );
    const sleep = vi.fn().mockResolvedValue(undefined);
    const adapter = new AssemblyAiSpeechToTextAdapter(
      fetchMock as unknown as typeof fetch,
      sleep,
    );

    await expect(adapter.transcribe(input)).resolves.toEqual({
      text: "Olá, world",
      languageCode: "pt",
      languageConfidence: 0.98,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.assemblyai.com/v2/upload",
      {
        method: "POST",
        headers: {
          authorization: expect.any(String),
          "content-type": "audio/webm",
        },
        body: input.audio,
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.assemblyai.com/v2/transcript",
      {
        method: "POST",
        headers: {
          authorization: expect.any(String),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          audio_url: "https://upload.test/audio",
          language_detection: true,
          language_detection_options: {
            expected_languages: ["pt", "en"],
            fallback_language: "auto",
          },
        }),
      },
    );
    expect(sleep).not.toHaveBeenCalled();
  });

  it("maps a provider error transcript status to BadGatewayError", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ upload_url: "https://upload.test/audio" }))
      .mockResolvedValueOnce(jsonResponse({ id: "transcript-id" }))
      .mockResolvedValueOnce(
        jsonResponse({ status: "error", error: "Provider failure" }),
      );
    const adapter = new AssemblyAiSpeechToTextAdapter(
      fetchMock as unknown as typeof fetch,
      vi.fn().mockResolvedValue(undefined),
    );

    await expect(adapter.transcribe(input)).rejects.toBeInstanceOf(
      BadGatewayError,
    );
  });

  it("maps a no-spoken-audio provider error to BadRequestError", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ upload_url: "https://upload.test/audio" }))
      .mockResolvedValueOnce(jsonResponse({ id: "transcript-id" }))
      .mockResolvedValueOnce(
        jsonResponse({
          status: "error",
          error:
            "language_detection cannot be performed on files with no spoken audio.",
        }),
      );
    const adapter = new AssemblyAiSpeechToTextAdapter(
      fetchMock as unknown as typeof fetch,
      vi.fn().mockResolvedValue(undefined),
    );

    await expect(adapter.transcribe(input)).rejects.toBeInstanceOf(
      BadRequestError,
    );
  });

  it("maps an overdue transcript poll to GatewayTimeoutError", async () => {
    let now = 0;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ upload_url: "https://upload.test/audio" }))
      .mockResolvedValueOnce(jsonResponse({ id: "transcript-id" }))
      .mockResolvedValueOnce(jsonResponse({ status: "processing" }));
    const sleep = vi.fn().mockImplementation(async () => {
      now += TRANSCRIBE_TIMEOUT_MS;
    });
    const adapter = new AssemblyAiSpeechToTextAdapter(
      fetchMock as unknown as typeof fetch,
      sleep,
      () => now,
    );

    await expect(adapter.transcribe(input)).rejects.toBeInstanceOf(
      GatewayTimeoutError,
    );

    expect(sleep).toHaveBeenCalledWith(TRANSCRIBE_POLL_INTERVAL_MS);
  });
});
