import { env } from "@/config/env";
import { ApiError } from "./client";

export type ResumeStatus = "processing" | "ready" | "failed";

export type ResumePreview = {
  id: string;
  name: string;
  status: ResumeStatus;
  createdAt: string;
};

export type StructuredSummary = {
  personal_info: { name: string; title: string; about: string };
  skills: string[];
  experiences: Array<{
    company: string;
    role: string;
    highlights: string[];
  }>;
  projects: Array<{
    name: string;
    description: string;
    technologies: string[];
    highlights: string[];
  }>;
  certifications: string[];
};

export type ResumeDetail = ResumePreview & {
  structuredSummary?: StructuredSummary;
};

export async function uploadResume(
  file: File,
  token: string,
): Promise<ResumePreview> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${env.NEXT_PUBLIC_SERVER_URL}/api/resumes/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    credentials: "include",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      typeof data === "object" && data && "message" in data
        ? String((data as { message: unknown }).message)
        : res.statusText;
    throw new ApiError(message, res.status, data);
  }

  return data as ResumePreview;
}

export async function getResume(
  id: string,
  token: string,
): Promise<ResumeDetail> {
  const res = await fetch(`${env.NEXT_PUBLIC_SERVER_URL}/api/resumes/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      typeof data === "object" && data && "message" in data
        ? String((data as { message: unknown }).message)
        : res.statusText;
    throw new ApiError(message, res.status, data);
  }

  return data as ResumeDetail;
}

export async function getResumeFile(
  id: string,
  token: string,
): Promise<Blob> {
  const res = await fetch(
    `${env.NEXT_PUBLIC_SERVER_URL}/api/resumes/${id}/file`,
    {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    },
  );

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message =
      typeof data === "object" && data && "message" in data
        ? String((data as { message: unknown }).message)
        : res.statusText;
    throw new ApiError(message, res.status, data);
  }

  return await res.blob();
}

export async function listResumes(
  token: string,
): Promise<{ resumes: ResumePreview[] }> {
  const res = await fetch(`${env.NEXT_PUBLIC_SERVER_URL}/api/resumes/`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      typeof data === "object" && data && "message" in data
        ? String((data as { message: unknown }).message)
        : res.statusText;
    throw new ApiError(message, res.status, data);
  }

  return data as { resumes: ResumePreview[] };
}

export async function deleteResume(
  id: string,
  token: string,
): Promise<void> {
  const res = await fetch(`${env.NEXT_PUBLIC_SERVER_URL}/api/resumes/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message =
      typeof data === "object" && data && "message" in data
        ? String((data as { message: unknown }).message)
        : res.statusText;
    throw new ApiError(message, res.status, data);
  }
}
