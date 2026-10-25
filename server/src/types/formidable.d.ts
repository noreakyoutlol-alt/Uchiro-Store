declare module 'formidable' {
  import { IncomingMessage } from 'http';

  export interface File {
    filepath: string;
    originalFilename: string | null;
    mimetype: string | null;
    size: number;
    lastModifiedDate?: Date;
    newFilename: string;
  }

  export interface Options {
    maxFileSize?: number;
    maxFiles?: number;
    keepExtensions?: boolean;
    allowEmptyFiles?: boolean;
    uploadDir?: string;
  }

  export class IncomingForm {
    constructor(options?: Options);
    parse(
      req: IncomingMessage,
      callback?: (err: any, fields: Record<string, any>, files: Record<string, any>) => void
    ): void;
  }
}
