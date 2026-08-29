import type { ResumeService } from "@/modules/resumes/service/resume-service";
import { BadRequestError } from "@/shared";
import type { Request, Response } from "express";

export class ResumesController {
  constructor(private readonly resumeService: ResumeService) {}

  upload = async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      throw new BadRequestError("Resume file is required");
    }

    const preview = await this.resumeService.upload(req.userId!, req.file);
    res.status(201).json(preview);
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    const detail = await this.resumeService.getResume(req.userId!, id);
    res.status(200).json(detail);
  };

  getFile = async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    const file = await this.resumeService.getFile(req.userId!, id);
    res.setHeader("Content-Type", file.headers.contentType);
    res.setHeader("Content-Disposition", file.headers.contentDisposition);
    res.setHeader("Content-Length", file.headers.contentLength);
    res.setHeader("Cache-Control", file.headers.cacheControl);
    res.status(200).send(file.body);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const previews = await this.resumeService.listResumes(req.userId!);
    res.status(200).json({ resumes: previews });
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    await this.resumeService.deleteResume(req.userId!, id);
    res.status(204).send();
  };
}
