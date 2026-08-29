"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  Trash2,
  Calendar,
  Star,
} from "lucide-react";

import { AppShell } from "@/features/dashboard/app-shell";
import { useConfirmDialog } from "@/components/providers/confirm-dialog-provider";
import { useAuth } from "@/features/auth/session-provider";
import { uploadResume } from "@/lib/api/resumes";
import { isAllowedResumeFile } from "@/lib/resumes/is-allowed-resume-file";
import { useDeleteResume } from "@/lib/query/hooks/use-delete-resume";
import { useResumes } from "@/lib/query/hooks/use-resumes";
import { queryKeys } from "@/lib/query/keys";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import {
  getStoredResumeId,
  setStoredResumeId,
} from "@/features/auth/session-storage";
import { AppCard } from "@/components/app/app-card";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { AppPageHeader } from "@/components/app/app-page-header";

type UploadState = "idle" | "uploading";

export default function ResumesPage() {
  const { getAccessToken } = useAuth();
  const queryClient = useQueryClient();
  const confirmDialog = useConfirmDialog();
  const deleteResumeMutation = useDeleteResume();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeResumeId, setActiveResumeId] = useState<string | null>(() =>
    getStoredResumeId(),
  );

  const { data, isLoading, error } = useResumes();
  const resumes = data?.resumes ?? [];
  const deletingId = deleteResumeMutation.isPending
    ? (deleteResumeMutation.variables ?? null)
    : null;

  // Automatically make the first ready resume active if none is set
  const readyResumes = resumes.filter((r) => r.status === "ready");
  if (!activeResumeId && readyResumes.length > 0) {
    const firstReadyId = readyResumes[0].id;
    setStoredResumeId(firstReadyId);
    setActiveResumeId(firstReadyId);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    if (!isAllowedResumeFile(file)) {
      setUploadError("Only PDF and TeX files are allowed");
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      toast.error("Not authenticated");
      return;
    }

    setUploadError(null);
    setUploadState("uploading");

    try {
      const preview = await uploadResume(file, token);
      toast.success("Resume uploaded successfully! Processing started.");

      // Invalidate query to trigger refresh
      void queryClient.invalidateQueries({ queryKey: queryKeys.resumes });

      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      // If no active resume is set, set this one
      if (!activeResumeId) {
        setStoredResumeId(preview.id);
        setActiveResumeId(preview.id);
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Upload failed";
      setUploadError(message);
      toast.error(message);
    } finally {
      setUploadState("idle");
    }
  }

  async function handleDelete(id: string) {
    if (deleteResumeMutation.isPending) return;
    const confirmed = await confirmDialog({
      title: "Delete this resume?",
      description:
        "All related interview sessions will be lost. This cannot be undone.",
    });
    if (!confirmed) return;

    const wasActive = activeResumeId === id;
    if (wasActive) {
      setStoredResumeId("");
      setActiveResumeId(null);
    }

    deleteResumeMutation.mutate(id, {
      onError: () => {
        if (wasActive) {
          setStoredResumeId(id);
          setActiveResumeId(id);
        }
      },
    });
  }

  function handleSetActive(id: string) {
    setStoredResumeId(id);
    setActiveResumeId(id);
    toast.success("Active resume updated!");
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-8">
        <AppPageHeader
          title="My resumes"
          description="Upload, manage, and select your active resumes for AI mock interviews."
        />

        {/* Upload Form */}
        <AppCard variant="mist" className="p-6">
          <h2 className="mb-4 text-base font-semibold text-ink-black">
            Upload New Resume
          </h2>
          <form onSubmit={handleUpload} className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.tex,application/pdf"
              className="hidden"
              onChange={(e) => {
                const selected = e.target.files?.[0] ?? null;
                if (selected && !isAllowedResumeFile(selected)) {
                  setFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                  setUploadError("Only PDF and TeX files are allowed");
                  return;
                }
                setFile(selected);
                setUploadError(null);
              }}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex w-full cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed border-smoke-gray bg-paper-white p-8 transition-colors hover:border-jade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2",
                file && "border-jade bg-jade-pale",
              )}
            >
              {file ? (
                <>
                  <FileText className="h-10 w-10 text-jade-deep" />
                  <span className="text-sm font-medium text-ink-black">
                    {file.name}
                  </span>
                  <span className="text-xs text-text-base">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-text-base" />
                  <span className="text-sm font-medium text-ink-black">
                    Click to select a resume
                  </span>
                  <span className="text-xs text-text-base">
                    PDF and LaTeX (.tex) files are supported
                  </span>
                </>
              )}
            </button>

            {uploadError && (
              <p
                className="text-sm font-medium text-(--status-critical-foreground)"
                role="alert"
                aria-live="assertive"
              >
                {uploadError}
              </p>
            )}

            <button
              type="submit"
              disabled={!file || uploadState === "uploading"}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-jade-deep px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-black disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
            >
              {uploadState === "uploading" && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {uploadState === "uploading"
                ? "Uploading & Enqueuing…"
                : "Upload resume"}
            </button>
          </form>
        </AppCard>

        {/* Resumes List */}
        <AppCard className="space-y-4 p-6">
          <h2 className="text-base font-semibold text-ink-black">
            Saved Resumes
          </h2>

          {isLoading && (
            <div
              className="flex items-center justify-center gap-2 py-8 text-sm text-text-base"
              role="status"
            >
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading resumes…
            </div>
          )}

          {error && (
            <p className="py-8 text-center text-sm text-red-700" role="alert">
              {error instanceof Error
                ? error.message
                : "Failed to load resumes"}
            </p>
          )}

          {!isLoading && !error && resumes.length === 0 && (
            <AppEmptyState
              icon={<FileText className="h-6 w-6" />}
              headingLevel={3}
              title="No resumes yet"
              description="Upload your first resume above to start practicing."
            />
          )}

          {!isLoading && !error && resumes.length > 0 && (
            <ul className="divide-y divide-border-hairline overflow-hidden rounded-2xl border border-border-hairline">
              {resumes.map((resume) => {
                const isActive = activeResumeId === resume.id;
                const isReady = resume.status === "ready";
                const isFailed = resume.status === "failed";
                const isProcessing = resume.status === "processing";

                return (
                  <li
                    key={resume.id}
                    className={cn(
                      "flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 transition-colors",
                      isActive ? "bg-jade-pale" : "hover:bg-mist-gray",
                    )}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <FileText
                        className={cn(
                          "mt-0.5 h-8 w-8 shrink-0",
                          isActive ? "text-jade-deep" : "text-text-base",
                        )}
                      />
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-ink-black">
                          {resume.name}
                        </h3>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-base">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(resume.createdAt).toLocaleDateString()}
                          </span>
                          <span>•</span>
                          {/* Status Badge */}
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium text-[10px] uppercase tracking-wider",
                              isReady && "bg-jade-pale text-jade-deep",
                              isFailed &&
                                "bg-(--status-critical-surface) text-text-base",
                              isProcessing &&
                                "bg-(--status-neutral-surface) text-(--status-neutral-foreground)",
                            )}
                          >
                            {isProcessing && (
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            )}
                            {isReady && <CheckCircle className="h-2.5 w-2.5" />}
                            {isFailed && <XCircle className="h-2.5 w-2.5" />}
                            {resume.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {isReady && (
                        <button
                          type="button"
                          onClick={() => handleSetActive(resume.id)}
                          className={cn(
                            "flex min-h-11 cursor-pointer items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2",
                            isActive
                              ? "border-transparent bg-jade-deep text-white"
                              : "border-border-hairline text-ink-black hover:bg-mist-gray",
                          )}
                        >
                          <Star
                            className={cn(
                              "h-3.5 w-3.5 fill-current",
                              isActive ? "text-yellow-300" : "text-transparent",
                            )}
                          />
                          {isActive ? "Active" : "Set Active"}
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={deletingId === resume.id}
                        onClick={() => handleDelete(resume.id)}
                        className="flex size-11 cursor-pointer items-center justify-center rounded-full border border-border-hairline text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
                        aria-label={`Delete ${resume.name}`}
                        title="Delete resume"
                      >
                        {deletingId === resume.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </AppCard>
      </div>
    </AppShell>
  );
}
