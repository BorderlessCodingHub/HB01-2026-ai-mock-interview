import { toast } from "sonner";

import { ApiError } from "@/lib/api/client";

export type OpenResumeFileParams = {
  id: string;
  name: string;
  getToken: () => Promise<string | null>;
  fetchBlob: (id: string, token: string) => Promise<Blob>;
};

function isTexResumeName(name: string): boolean {
  return name.slice(-4).toLowerCase() === ".tex";
}

function triggerDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

async function downloadTexResume({
  id,
  name,
  getToken,
  fetchBlob,
}: OpenResumeFileParams): Promise<void> {
  try {
    const token = await getToken();
    if (!token) {
      toast.error("Not authenticated");
      return;
    }

    const blob = await fetchBlob(id, token);
    triggerDownload(blob, name);
  } catch (err) {
    const message =
      err instanceof ApiError ? err.message : "Failed to open resume";
    toast.error(message);
  }
}

async function previewPdfResume({
  id,
  getToken,
  fetchBlob,
}: OpenResumeFileParams): Promise<void> {
  const previewTab = window.open("about:blank", "_blank");
  if (!previewTab) {
    toast.error("Allow popups to preview the resume");
    return;
  }

  try {
    const token = await getToken();
    if (!token) {
      previewTab.close();
      toast.error("Not authenticated");
      return;
    }

    const blob = await fetchBlob(id, token);
    const pdfBlob = new Blob([blob], { type: "application/pdf" });
    const objectUrl = URL.createObjectURL(pdfBlob);
    previewTab.location.replace(objectUrl);
  } catch (err) {
    previewTab.close();
    const message =
      err instanceof ApiError ? err.message : "Failed to open resume";
    toast.error(message);
  }
}

export async function openResumeFile(
  params: OpenResumeFileParams,
): Promise<void> {
  if (isTexResumeName(params.name)) {
    await downloadTexResume(params);
    return;
  }

  await previewPdfResume(params);
}
