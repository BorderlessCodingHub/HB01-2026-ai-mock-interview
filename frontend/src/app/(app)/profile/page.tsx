"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import {
  User,
  Briefcase,
  Code,
  FolderGit2,
  Award,
  Loader2,
  FileText,
  AlertCircle,
} from "lucide-react";

import { AppShell } from "@/features/dashboard/app-shell";
import { useResumes } from "@/lib/query/hooks/use-resumes";
import { useResume } from "@/lib/query/hooks/use-resume";
import { getStoredResumeId } from "@/features/auth/session-storage";
import { cn } from "@/lib/utils";
import { AppCard } from "@/components/app/app-card";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { AppPageHeader } from "@/components/app/app-page-header";

type TabType =
  | "personal"
  | "experiences"
  | "projects"
  | "skills"
  | "certifications";

const getProfileTabId = (tab: TabType) => `profile-tab-${tab}`;
const getProfilePanelId = (tab: TabType) => `profile-panel-${tab}`;

export default function ProfilePage() {
  const {
    data: resumesData,
    isLoading: isLoadingList,
    error: listError,
  } = useResumes();
  const resumes = resumesData?.resumes ?? [];
  const readyResumes = resumes.filter((r) => r.status === "ready");

  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("personal");

  const resolvedResumeId = useMemo(() => {
    if (selectedResumeId) {
      return selectedResumeId;
    }

    if (readyResumes.length === 0) {
      return null;
    }

    const activeId = getStoredResumeId();
    const hasActive = readyResumes.some((r) => r.id === activeId);
    return hasActive ? activeId : readyResumes[0].id;
  }, [readyResumes, selectedResumeId]);

  const {
    data: resume,
    isLoading: isLoadingResume,
    error: resumeError,
  } = useResume(resolvedResumeId);

  const parsed = resume?.structuredSummary;

  const tabs: { value: TabType; label: string; icon: typeof User }[] = [
    { value: "personal", label: "Personal Info", icon: User },
    { value: "experiences", label: "Work Experience", icon: Briefcase },
    { value: "projects", label: "Projects", icon: FolderGit2 },
    { value: "skills", label: "Skills", icon: Code },
    { value: "certifications", label: "Certifications", icon: Award },
  ];

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) {
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = tabs.length - 1;
    }

    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = tabs[nextIndex].value;
    setActiveTab(nextTab);
    document.getElementById(getProfileTabId(nextTab))?.focus();
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <AppPageHeader
          title="Resume profile"
          description="Parsed data automatically extracted by AI from your uploaded CV."
          actions={
            readyResumes.length > 1 ? (
              <div className="flex items-center gap-2">
                <label
                  htmlFor="resume-select"
                  className="text-xs font-semibold text-text-base"
                >
                  Select CV:
                </label>
                <select
                  id="resume-select"
                  value={resolvedResumeId ?? ""}
                  onChange={(e) => setSelectedResumeId(e.target.value)}
                  className="cursor-pointer rounded-full border border-border-hairline bg-paper-white px-3 py-1.5 text-sm font-medium text-ink-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
                >
                  {readyResumes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : undefined
          }
        />

        {isLoadingList && (
          <div
            className="flex items-center justify-center gap-2 py-12 text-sm text-text-base"
            role="status"
          >
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading profiles…
          </div>
        )}

        {!isLoadingList && listError && (
          <p
            className="py-12 text-center text-sm text-(--status-critical-foreground)"
            role="alert"
          >
            {listError instanceof Error
              ? listError.message
              : "Failed to load resume profiles"}
          </p>
        )}

        {!isLoadingList && !listError && readyResumes.length === 0 && (
          <AppEmptyState
            icon={<AlertCircle className="h-6 w-6" />}
            headingLevel={2}
            title="No ready CV found"
            description="We couldn't find a successfully processed resume. Upload a resume first."
            action={
              <a
                href="/resumes"
                className="inline-flex cursor-pointer rounded-full bg-jade-deep px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-ink-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
              >
                Go to Resumes
              </a>
            }
          />
        )}

        {!isLoadingList && !listError && readyResumes.length > 0 && (
          <div className="space-y-6">
            {/* Tabs Selector */}
            <div
              className="flex gap-4 overflow-x-auto border-b border-border-hairline"
              role="tablist"
              aria-label="Resume profile sections"
            >
              {tabs.map((tab, index) => {
                const Icon = tab.icon;
                const active = activeTab === tab.value;
                return (
                  <button
                    key={tab.value}
                    id={getProfileTabId(tab.value)}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-controls={getProfilePanelId(tab.value)}
                    tabIndex={active ? 0 : -1}
                    onClick={() => setActiveTab(tab.value)}
                    onKeyDown={(event) => handleTabKeyDown(event, index)}
                    className={cn(
                      "flex min-h-11 shrink-0 cursor-pointer items-center gap-2 border-b-2 px-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2",
                      active
                        ? "border-jade-deep text-jade-deep"
                        : "border-transparent text-text-base hover:text-ink-black",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Profile Tab Contents */}
            {tabs.map((tab) => {
              const panelActive = activeTab === tab.value;
              return (
                <AppCard
                  key={tab.value}
                  id={getProfilePanelId(tab.value)}
                  role="tabpanel"
                  aria-labelledby={getProfileTabId(tab.value)}
                  tabIndex={panelActive ? 0 : -1}
                  hidden={!panelActive}
                  className="min-h-[300px] p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
                >
                  {isLoadingResume && (
                    <div
                      className="flex items-center justify-center gap-2 py-12 text-sm text-text-base"
                      role="status"
                    >
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Parsing CV details…
                    </div>
                  )}
                  {!isLoadingResume && resumeError && (
                    <p
                      className="py-12 text-center text-sm text-(--status-critical-foreground)"
                      role="alert"
                    >
                      {resumeError instanceof Error
                        ? resumeError.message
                        : "Failed to load profile details"}
                    </p>
                  )}
                  {!isLoadingResume && !resumeError && !parsed && (
                    <p className="py-12 text-center text-sm text-text-base">
                      Parsed profile details are unavailable.
                    </p>
                  )}
                  {!isLoadingResume && !resumeError && parsed && (
                    <>
                      {/* Personal Tab */}
                      {activeTab === "personal" && (
                        <div className="space-y-6">
                          <div className="flex items-start gap-4">
                            <div className="flex size-14 items-center justify-center rounded-2xl bg-jade-pale text-jade-deep">
                              <User className="h-7 w-7" />
                            </div>
                            <div>
                              <h2 className="text-xl font-semibold text-ink-black">
                                {parsed.personal_info.name}
                              </h2>
                              <p className="mt-0.5 text-sm font-medium text-text-base">
                                {parsed.personal_info.title}
                              </p>
                            </div>
                          </div>

                          <div className="border-t border-border-hairline pt-4">
                            <h3 className="mb-2 text-sm font-semibold text-ink-black">
                              About
                            </h3>
                            <p className="whitespace-pre-line text-sm leading-relaxed text-text-base">
                              {parsed.personal_info.about ||
                                "No summary provided."}
                            </p>
                          </div>

                          <div className="grid grid-cols-1 gap-4 border-t border-border-hairline pt-4 text-sm sm:grid-cols-2">
                            <div className="flex items-center gap-2.5 text-text-base">
                              <FileText className="h-4 w-4 shrink-0" />
                              <span className="truncate text-ink-black">
                                Source: {resume.name}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Experiences Tab */}
                      {activeTab === "experiences" && (
                        <div className="space-y-6">
                          <h2 className="border-b border-border-hairline pb-2 text-lg font-semibold text-ink-black">
                            Work History
                          </h2>
                          {parsed.experiences.length === 0 ? (
                            <AppEmptyState
                              compact
                              headingLevel={3}
                              title="No work experiences found"
                            />
                          ) : (
                            <div className="relative space-y-6 before:absolute before:bottom-2 before:left-3 before:top-2 before:w-px before:bg-border-hairline">
                              {parsed.experiences.map((exp, idx) => (
                                <div key={idx} className="relative pl-8">
                                  <div className="absolute left-[7px] top-1.5 size-2.5 rounded-full bg-jade-deep ring-4 ring-paper-white" />
                                  <div>
                                    <h3 className="text-base font-semibold text-ink-black">
                                      {exp.role}
                                    </h3>
                                    <p className="mt-0.5 text-sm font-medium text-text-base">
                                      {exp.company}
                                    </p>
                                    {exp.highlights &&
                                      exp.highlights.length > 0 && (
                                        <ul className="mt-3 list-outside list-disc space-y-1.5 pl-4 text-sm text-text-base">
                                          {exp.highlights.map((item, key) => (
                                            <li key={key}>{item}</li>
                                          ))}
                                        </ul>
                                      )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Projects Tab */}
                      {activeTab === "projects" && (
                        <div className="space-y-6">
                          <h2 className="border-b border-border-hairline pb-2 text-lg font-semibold text-ink-black">
                            Technical Projects
                          </h2>
                          {parsed.projects.length === 0 ? (
                            <AppEmptyState
                              compact
                              headingLevel={3}
                              title="No projects found"
                            />
                          ) : (
                            <div className="grid grid-cols-1 gap-6">
                              {parsed.projects.map((proj, idx) => (
                                <div
                                  key={idx}
                                  className="space-y-3 rounded-2xl bg-mist-gray p-5"
                                >
                                  <div>
                                    <h3 className="text-base font-semibold text-ink-black">
                                      {proj.name}
                                    </h3>
                                    <p className="mt-1 text-sm text-text-base">
                                      {proj.description}
                                    </p>
                                  </div>

                                  {proj.technologies &&
                                    proj.technologies.length > 0 && (
                                      <div className="flex flex-wrap gap-1.5">
                                        {proj.technologies.map((tech, key) => (
                                          <span
                                            key={key}
                                            className="rounded-full bg-jade-pale px-2 py-0.5 text-[11px] font-medium text-jade-deep"
                                          >
                                            {tech}
                                          </span>
                                        ))}
                                      </div>
                                    )}

                                  {proj.highlights &&
                                    proj.highlights.length > 0 && (
                                      <ul className="list-disc space-y-1 border-t border-border-hairline pt-2 pl-4 text-sm text-text-base">
                                        {proj.highlights.map((item, key) => (
                                          <li key={key}>{item}</li>
                                        ))}
                                      </ul>
                                    )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Skills Tab */}
                      {activeTab === "skills" && (
                        <div className="space-y-4">
                          <h2 className="border-b border-border-hairline pb-2 text-lg font-semibold text-ink-black">
                            Professional Skills
                          </h2>
                          {parsed.skills.length === 0 ? (
                            <AppEmptyState
                              compact
                              headingLevel={3}
                              title="No skills found"
                            />
                          ) : (
                            <div className="flex flex-wrap gap-2 pt-2">
                              {parsed.skills.map((skill, idx) => (
                                <span
                                  key={idx}
                                  className="rounded-full bg-jade-pale px-3.5 py-1.5 text-xs font-medium text-jade-deep"
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Certifications Tab */}
                      {activeTab === "certifications" && (
                        <div className="space-y-4">
                          <h2 className="border-b border-border-hairline pb-2 text-lg font-semibold text-ink-black">
                            Certifications & Licenses
                          </h2>
                          {parsed.certifications.length === 0 ? (
                            <AppEmptyState
                              compact
                              headingLevel={3}
                              title="No certifications found"
                            />
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                              {parsed.certifications.map((cert, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center gap-3 rounded-2xl bg-mist-gray p-3.5"
                                >
                                  <Award className="h-5 w-5 shrink-0 text-jade-deep" />
                                  <span className="text-sm font-semibold text-ink-black">
                                    {cert}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </AppCard>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
