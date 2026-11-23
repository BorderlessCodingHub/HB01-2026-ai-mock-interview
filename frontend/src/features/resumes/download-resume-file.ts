import { toast } from "sonner";

import { getErrorMessage } from "@/components/app/app-error-state";

export type DownloadResumeFileParams = {
  id: string;
  name: string;
  getToken: () => Promise<string | null>;
  fetchBlob: (id: string, token: string) => Promise<Blob>;
};

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

export async function downloadResumeFile({
  id,
  name,
  getToken,
  fetchBlob,
}: DownloadResumeFileParams): Promise<void> {
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
      getErrorMessage(err, "Failed to download resume");
    toast.error(message);
  }
}
