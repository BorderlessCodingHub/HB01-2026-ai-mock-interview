import { env } from "@/config/env";
import multer from "multer";

export const resumeUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  // Browsers send UTF-8 filenames; multer defaults to latin1, which garbles
  // accented names such as "Currículo João.pdf".
  defParamCharset: "utf8",
  limits: {
    fileSize: env.RESUME_MAX_BYTES,
  },
});
